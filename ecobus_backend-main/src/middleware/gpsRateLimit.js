/**
 * GPS ingestion rate limiter.
 *
 * Rejects pings from the same bus arriving < 3s apart (configurable).
 * Uses an in-memory LRU-ish map keyed by busId. This is intentionally
 * per-process — when the API is scaled horizontally, replace with Redis.
 *
 * Rejections return HTTP 429 with a clear error so the device can back off.
 */
import { ApiError } from '../utils/ApiError.js';

const MIN_INTERVAL_MS = Number(process.env.GPS_MIN_INTERVAL_MS || 3000);
const MAX_KEYS = 5000;

const lastSeen = new Map();

const evictIfNeeded = () => {
  if (lastSeen.size <= MAX_KEYS) return;
  // Evict the oldest entries (insertion order = iteration order in Map).
  const toDrop = lastSeen.size - MAX_KEYS;
  let i = 0;
  for (const key of lastSeen.keys()) {
    lastSeen.delete(key);
    if (++i >= toDrop) break;
  }
};

export const gpsRateLimiter = (req, _res, next) => {
  const busId = req.body?.busId;
  if (!busId) return next(); // validation will reject below

  const now = Date.now();
  const prev = lastSeen.get(busId);
  if (prev && now - prev < MIN_INTERVAL_MS) {
    return next(
      ApiError.badRequest(
        `GPS pings must be at least ${MIN_INTERVAL_MS}ms apart for the same bus`,
        { retryAfterMs: MIN_INTERVAL_MS - (now - prev) },
      ),
    );
  }
  lastSeen.set(busId, now);
  evictIfNeeded();
  next();
};
