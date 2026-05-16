import 'dotenv/config';

const required = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
};

/**
 * Resolve SSL config for the PG pool.
 *
 * Priority:
 *   1. PGSSL=true / PGSSL=false  → explicit override
 *   2. `?sslmode=require|verify-full|...` in DATABASE_URL → enable SSL
 *   3. Hostname looks managed (Neon, Supabase, Render, Railway, Heroku, RDS, Azure, GCP)
 *      → enable SSL by default
 *   4. Otherwise (localhost / docker network) → disable SSL
 *
 * `rejectUnauthorized: false` is used because most managed providers serve
 * certificates signed by intermediate CAs not present in the Node trust store.
 * Set `PGSSL_STRICT=true` to enforce strict verification.
 */
const resolveSsl = (databaseUrl) => {
  const explicit = process.env.PGSSL;
  if (explicit === 'false') return false;
  if (explicit === 'true') {
    return { rejectUnauthorized: process.env.PGSSL_STRICT === 'true' };
  }

  try {
    const url = new URL(databaseUrl);
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode && sslmode !== 'disable') {
      return { rejectUnauthorized: sslmode === 'verify-full' || process.env.PGSSL_STRICT === 'true' };
    }

    const host = url.hostname;
    const managed = /(neon\.tech|supabase\.co|render\.com|railway\.app|herokuapp\.com|amazonaws\.com|azure\.com|gcp\.|cockroachlabs\.cloud|aiven|digitalocean\.com)$/i;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === 'db' || host.endsWith('.local');
    if (!isLocal && managed.test(host)) {
      return { rejectUnauthorized: process.env.PGSSL_STRICT === 'true' };
    }
  } catch {
    // Malformed URL — fall through; pg will surface a clearer error.
  }

  return false;
};

const databaseUrl = required(
  'DATABASE_URL',
  'postgres://postgres:postgres@localhost:5432/ecobus',
);

const stripPgSslQueryParams = (urlString) => {
  try {
    const url = new URL(urlString);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');
    return url.toString();
  } catch {
    return urlString;
  }
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  databaseUrl,
  pgConnectionString: stripPgSslQueryParams(databaseUrl),
  pgSsl: resolveSsl(databaseUrl),

  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  gpsMinIntervalMs: Number(process.env.GPS_MIN_INTERVAL_MS || 3000),

  corsOrigin: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),

  logLevel: process.env.LOG_LEVEL || 'info',
};

export const isProd = env.nodeEnv === 'production';
