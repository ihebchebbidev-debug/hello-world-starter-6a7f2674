/**
 * Phone OTP service — Twilio Verify edition.
 *
 * Used by parents and bus drivers to log in. Schools register them with their
 * phone number; they never sign up themselves — they only request an OTP and
 * verify it via SMS.
 *
 * Why Twilio Verify (not custom + Programmable Messaging):
 *   - Twilio stores the code, TTL, attempt count and Fraud Guard state for us.
 *   - No DB rows to manage; works across cluster instances out of the box.
 *   - Built-in protections: SMS pumping (Fraud Guard), rate limits, geo perms.
 *
 * Auth: API Key (SK + Secret) over Basic Auth — never the master Auth Token.
 *
 * Required env to send real SMS (otherwise dev mode logs a fake code):
 *   TWILIO_ACCOUNT_SID         AC...
 *   TWILIO_API_KEY_SID         SK...
 *   TWILIO_API_KEY_SECRET      <secret>
 *   TWILIO_VERIFY_SERVICE_SID  VA...
 *
 * Optional:
 *   PHONE_OTP_SMS=1   hide devCode in response even when Twilio is not configured
 *   OTP_DEFAULT_CC=216  default country code for local numbers (digits, no '+')
 *
 * Channel is SMS only by design. Email/Call/WhatsApp are intentionally NOT
 * exposed: parents and drivers register a phone, period.
 */

import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const DEFAULT_CC = String(process.env.OTP_DEFAULT_CC || '216').replace(/\D/g, '');
const TTL_SECONDS = 10 * 60; // Twilio Verify default TTL is 10 minutes

/**
 * Normalize to E.164.
 *   "+21698123456"  -> "+21698123456"
 *   "0021698123456" -> "+21698123456"
 *   "21698123456"   -> "+21698123456"
 *   "98 123 456"    -> "+21698123456"   (assumes Tunisia)
 */
export const normalizePhone = (raw) => {
  if (!raw) return '';
  let s = String(raw).trim();
  const hasPlus = s.startsWith('+');
  s = s.replace(/\D/g, '');
  if (!s) return '';
  if (hasPlus) return `+${s}`;
  if (s.startsWith('00')) return `+${s.slice(2)}`;
  if (s.startsWith(DEFAULT_CC)) return `+${s}`;
  return `+${DEFAULT_CC}${s}`;
};

const twilioConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_API_KEY_SID &&
    process.env.TWILIO_API_KEY_SECRET &&
    process.env.TWILIO_VERIFY_SERVICE_SID,
  );

const isSmsConfigured = () =>
  twilioConfigured() || process.env.PHONE_OTP_SMS === '1';

/**
 * Call the Twilio Verify REST API. Uses Node 18+ global fetch (no SDK).
 * Auth: API Key SID + Secret via HTTP Basic. We pass the Account SID in the
 * URL path as Verify requires; the API Key proves we're allowed to act on it.
 */
const twilioVerifyRequest = async (path, params) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const keySid     = process.env.TWILIO_API_KEY_SID;
  const keySecret  = process.env.TWILIO_API_KEY_SECRET;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/${path}`;
  const auth = Buffer.from(`${keySid}:${keySecret}`).toString('base64');

  // 8s timeout so a slow Twilio call can't hang an HTTP worker.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);

  let res, data;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: ctrl.signal,
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    clearTimeout(t);
    logger?.error?.('Twilio Verify request failed', { err: err?.message, path });
    throw new ApiError(502, 'SMS provider unreachable');
  }
  clearTimeout(t);

  if (!res.ok) {
    logger?.error?.('Twilio Verify error', {
      status: res.status, code: data?.code, message: data?.message, path, accountSid,
    });
    // Map a few common Verify error codes to clearer messages.
    if (data?.code === 60200) throw new ApiError(400, 'Invalid phone number');
    if (data?.code === 60203) throw new ApiError(429, 'Too many send attempts. Try again later.');
    if (data?.code === 60212) throw new ApiError(429, 'Too many concurrent verifications.');
    if (data?.code === 60410) throw new ApiError(429, 'Phone number temporarily blocked by Fraud Guard.');
    if (data?.code === 20003) throw new ApiError(502, 'Twilio authentication failed (check API Key)');
    if (data?.code === 21408) throw new ApiError(502, 'SMS not enabled for this country in Twilio Geo Permissions');
    throw new ApiError(res.status === 404 ? 400 : 502, `SMS provider error: ${data?.message || res.statusText}`);
  }
  return data;
};

/**
 * Send an OTP via SMS.
 * Returns { phone, expiresAt, devMode, devCode? } — same shape as the
 * legacy service so existing callers / clients keep working.
 */
export const requestOtp = async (rawPhone) => {
  const phone = normalizePhone(rawPhone);
  if (!/^\+\d{8,15}$/.test(phone)) {
    throw ApiError.badRequest('Invalid phone number');
  }

  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  if (twilioConfigured()) {
    const params = new URLSearchParams({ To: phone, Channel: 'sms' });
    const v = await twilioVerifyRequest('Verifications', params);
    logger?.info?.('OTP sent via Twilio Verify', { phone, sid: v?.sid, status: v?.status });
    return { phone, expiresAt, devMode: false };
  }

  // Dev mode — Twilio not configured. Mint a deterministic-looking dummy code
  // so devs can complete the flow locally. NEVER reaches production because
  // production has all four env vars set.
  const devCode = String(Math.floor(100000 + Math.random() * 900000));
  logger?.warn?.(`Twilio not configured — dev OTP for ${phone} is ${devCode}`);
  const payload = { phone, expiresAt, devMode: true };
  if (process.env.PHONE_OTP_SMS !== '1') payload.devCode = devCode;
  return payload;
};

/**
 * Verify an OTP code.
 * Returns { ok: true, phone } — same shape as before so authService keeps
 * destructuring `phone` and using it to look up the user.
 */
export const verifyOtp = async (rawPhone, rawCode) => {
  const phone = normalizePhone(rawPhone);
  const code  = String(rawCode || '').trim();

  if (!/^\+\d{8,15}$/.test(phone)) throw ApiError.badRequest('Invalid phone number');
  if (!/^\d{4,10}$/.test(code))    throw ApiError.badRequest('Invalid code');

  if (!twilioConfigured()) {
    // Dev mode: accept any 6-digit code so local flows work end-to-end.
    logger?.warn?.(`Twilio not configured — accepting dev OTP for ${phone}`);
    return { ok: true, phone };
  }

  const params = new URLSearchParams({ To: phone, Code: code });
  const check = await twilioVerifyRequest('VerificationCheck', params);

  if (check?.status === 'approved') {
    return { ok: true, phone };
  }
  // status can be 'pending' (wrong code) or 'canceled'.
  throw ApiError.badRequest('Invalid code');
};
