# EcoBus V2 — Backend API

Production-ready **Node.js + Express + PostgreSQL** backend for the EcoBus
smart school-bus tracking platform.

> Multi-tenant • JWT auth • Real-time GPS over Socket.IO • Auto-migrations
> • OpenAPI docs • Structured logs with request correlation

---

## Table of contents

1. [Architecture](#architecture)
2. [Quick start (local)](#quick-start-local)
3. [Environment variables (`.env`)](#environment-variables-env)
4. [Connecting any PostgreSQL](#connecting-any-postgresql)
5. [Database schema & migrations](#database-schema--migrations)
6. [Running with Docker](#running-with-docker)
7. [Deployment checklist](#deployment-checklist)
8. [Health & readiness probes](#health--readiness-probes)
9. [Backend logs](#backend-logs)
10. [Request correlation id](#request-correlation-id)
11. [API documentation](#api-documentation)
12. [GitHub auto-sync (optional)](#github-auto-sync-optional)
13. [Project structure](#project-structure)

---

## Architecture

| Layer            | Tech                                                     |
|------------------|----------------------------------------------------------|
| Runtime          | Node.js ≥ 18 (ESM)                                       |
| HTTP             | Express 4 + Helmet + CORS + express-rate-limit           |
| Realtime         | Socket.IO 4 (rooms per `org:{id}` and `bus:{id}`)        |
| Database         | PostgreSQL 14+ via `pg` connection pool                  |
| Auth             | JWT (HS256) + bcrypt password hashing                    |
| Validation       | Zod                                                      |
| Logging          | Winston + daily-rotating JSON files + web log viewer     |
| Docs             | OpenAPI 3.0 generated from JSDoc, served via Swagger UI  |
| Migrations       | Versioned SQL files, **auto-applied on boot**            |

The HTTP server boots in `src/server.js`, which:

1. Pings PostgreSQL using `DATABASE_URL` and aborts on failure.
2. Runs any pending `migrations/sql/*.up.sql` inside transactions.
3. Starts Express + Socket.IO on `PORT`.
4. Optionally starts the GitHub sync worker.

---

## Quick start (local)

```bash
cd nodejsapp
cp .env.example .env          # edit DATABASE_URL + JWT_SECRET at minimum
npm install
npm run dev                   # nodemon, auto-migrates, hot reload
```

Then open:

- API:        <http://localhost:4000/api/v1/health>
- Docs:       <http://localhost:4000/api/docs>
- Log viewer: <http://localhost:4000/api/v1/logs/viewer>

**Don't have a Postgres locally?** Spin one up:

```bash
docker run -d --name ecobus-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ecobus postgres:16-alpine
```

…and use `DATABASE_URL=postgres://postgres:postgres@localhost:5432/ecobus`.

---

## Environment variables (`.env`)

Every variable is documented inline in [`.env.example`](./.env.example).
The only ones you **must** change before deploying are:

| Variable           | Why                                                       |
|--------------------|-----------------------------------------------------------|
| `DATABASE_URL`     | Connection string for your PostgreSQL                     |
| `JWT_SECRET`       | 48+ random bytes — signs auth tokens                      |
| `LOG_VIEWER_TOKEN` | Bearer for the `/logs` UI/API                             |
| `CORS_ORIGIN`      | Comma-list of allowed frontend origins (or `*`)           |

Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Full reference

| Var | Default | Notes |
|-----|---------|-------|
| `NODE_ENV` | `development` | Set to `production` when deploying |
| `PORT` | `4000` | HTTP listen port |
| `API_PREFIX` | `/api/v1` | All routes mounted under this |
| `DATABASE_URL` | local docker | See [Connecting any PostgreSQL](#connecting-any-postgresql) |
| `PGSSL` | *(auto)* | `true`/`false` to override SSL detection |
| `PGSSL_STRICT` | `false` | Verify CA cert (most managed DBs fail strict) |
| `PG_POOL_MAX` | `20` | Pool size per Node process |
| `JWT_SECRET` | dev fallback | **Required in prod** |
| `JWT_EXPIRES_IN` | `7d` | `zeit/ms` syntax |
| `BCRYPT_ROUNDS` | `12` | Cost factor for password hashing |
| `CORS_ORIGIN` | `*` | Comma-separated origins |
| `RATE_LIMIT_WINDOW_MS` | `900000` | 15 min |
| `RATE_LIMIT_MAX` | `300` | Requests per IP per window |
| `LOG_LEVEL` | `info` | `error\|warn\|info\|http\|debug` |
| `LOG_DIR` | `./logs` | Rotating JSON files written here |
| `LOG_VIEWER_TOKEN` | — | Required to access `/logs/*` |
| `AUTO_MIGRATE` | `true` | Set `false` to disable boot migrations |
| `GIT_SYNC_ENABLED` | `false` | See [GitHub auto-sync](#github-auto-sync-optional) |

---

## Connecting any PostgreSQL

Just set `DATABASE_URL`. SSL is **auto-detected** based on the URL's
`sslmode=` query and the hostname (Neon, Supabase, Render, Railway,
Heroku, RDS, Azure, GCP, DigitalOcean, CockroachDB, Aiven are recognized).

| Provider | Example `DATABASE_URL` |
|----------|------------------------|
| **Local Docker** | `postgres://postgres:postgres@localhost:5432/ecobus` |
| **Neon**       | `postgresql://USER:PASS@ep-xxx.eu-central-1.aws.neon.tech/ecobus?sslmode=require` |
| **Supabase**   | `postgresql://postgres:PASS@db.xxx.supabase.co:5432/postgres` |
| **Render**     | `postgresql://USER:PASS@dpg-xxx.oregon-postgres.render.com/ecobus` |
| **Railway**    | `postgresql://postgres:PASS@containers-us-west-x.railway.app:6543/railway` |
| **Heroku**     | `postgres://USER:PASS@ec2-xx.compute-1.amazonaws.com:5432/db` |
| **AWS RDS**    | `postgresql://USER:PASS@db.xxx.us-east-1.rds.amazonaws.com:5432/ecobus` |

If your provider isn't auto-detected but requires SSL, force it:

```env
PGSSL=true
```

The first thing the server does on boot is a `SELECT 1` against the URL
and logs the database name + Postgres version. If the URL is wrong you'll
see one clear error and the process exits with code `1` — perfect for
Docker/Kubernetes restart loops.

> **You do not need to create the schema manually.** As long as the user
> in `DATABASE_URL` can `CREATE TABLE`, the boot migration runner provisions
> all 26 tables, indexes and constraints automatically.

---

## Database schema & migrations

Versioned pairs in `migrations/sql/`:

```
001_init.up.sql       /  001_init.down.sql       — orgs, users, roles
002_fleet.up.sql      /  002_fleet.down.sql      — buses, routes, stops
003_tracking.up.sql   /  003_tracking.down.sql   — trips, GPS, live status
004_alerts.up.sql     /  004_alerts.down.sql     — checkins, SOS, notifications
005_analytics.up.sql  /  005_analytics.down.sql  — visitors, sessions, events
```

State is tracked in `schema_migrations(version, applied_at)`. Each up file
runs inside a single transaction, so a failure rolls back cleanly.

CLI commands (also runnable manually):

```bash
npm run migrate           # apply pending
npm run migrate:status    # show applied / pending
npm run migrate:down      # roll back the latest
npm run seed              # seed roles + a demo organization
```

---

## Running with Docker

```bash
# Build the production image (multi-stage, non-root, tini, healthcheck)
docker build -t ecobus-api ./nodejsapp

# Run with your env file
docker run --rm -p 4000:4000 \
  --env-file ./nodejsapp/.env \
  -v $(pwd)/logs:/app/logs \
  ecobus-api
```

Or with the bundled `docker-compose.yml` (spins up Postgres too):

```bash
cd nodejsapp
docker compose up --build
```

The image:

- Runs as non-root user `app` under `tini` (clean signal handling)
- Embeds a `HEALTHCHECK` that calls `/api/v1/health` every 30 s
- Writes rotating JSON logs to `/app/logs` — mount a volume to persist

---

## Deployment checklist

Before pointing traffic at the API:

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` set; provider's SSL/firewall allows the API
- [ ] `JWT_SECRET` ≥ 48 random bytes (not the example)
- [ ] `LOG_VIEWER_TOKEN` set to a long random string (or remove the route)
- [ ] `CORS_ORIGIN` restricted to your real frontend origins
- [ ] Reverse proxy (nginx, Caddy, ELB…) forwards `X-Forwarded-For`
      (Express already has `trust proxy` enabled)
- [ ] Persist `/app/logs` if you want long-term log retention
- [ ] Wire your platform's healthcheck to `GET /api/v1/health`
      and readiness gate to `GET /api/v1/health/ready`
- [ ] Backups configured on the PostgreSQL side

---

## Health & readiness probes

| Path                       | Purpose                                              |
|----------------------------|------------------------------------------------------|
| `GET /api/v1/health`       | Liveness — process up (always 200)                   |
| `GET /api/v1/health/ready` | Readiness — DB ping + 26 required tables (200/503)   |

Sample readiness payload:

```json
{
  "status": "ok",
  "totalLatencyMs": 12,
  "checks": {
    "database": { "status": "ok", "latencyMs": 3, "error": null },
    "schema":   { "status": "ok", "present": 26, "required": 26, "missing": [] }
  },
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

---

## Backend logs

All logs go to **stdout** (pretty) **and** to rotating JSON files in
`$LOG_DIR/ecobus-YYYY-MM-DD.log` (1 file/day, 14 days retained, 20 MB cap).

| Path                        | What                                            |
|-----------------------------|-------------------------------------------------|
| `GET /api/v1/logs/viewer`   | Web UI — search, level filter, live tail        |
| `GET /api/v1/logs/tail`     | JSON tail (`?level=&search=&limit=&file=`)      |
| `GET /api/v1/logs/files`    | List rotated files                              |
| `GET /api/v1/logs/stream`   | Server-Sent Events live stream                  |

Auth: `?token=$LOG_VIEWER_TOKEN` (UI/SSE) or `X-Log-Token` header (API).

```bash
curl -s "http://localhost:4000/api/v1/logs/tail?token=$LOG_VIEWER_TOKEN&level=error&limit=50" | jq
curl -N "http://localhost:4000/api/v1/logs/stream?token=$LOG_VIEWER_TOKEN"
```

---

## Request correlation id

Every request is tagged with `X-Request-Id`:

- Honors a client-supplied `X-Request-Id` (alphanumeric, `_`/`-`, ≤128 chars)
  or generates a UUID v4.
- Echoed in the `X-Request-Id` response header (CORS-exposed).
- Included in every error response body as `requestId`.
- Attached to every log line so a single request can be grepped end-to-end.

```bash
curl -i -H 'X-Request-Id: trace-demo-1' http://localhost:4000/api/v1/health
grep trace-demo-1 logs/ecobus-*.log
```

---

## API documentation

Interactive Swagger UI is served by the API itself:

- **Swagger UI**: <http://localhost:4000/api/docs>
- **OpenAPI JSON**: <http://localhost:4000/api/docs.json>

Specs are generated from JSDoc `@openapi` blocks in `src/routes/*.js` plus
shared schemas in `src/config/swagger.js`. Add a new endpoint by writing
an `@openapi` block above the handler — the spec auto-updates.

---

## GitHub auto-sync (optional)

Keep a long-running container in step with a GitHub branch:

```env
GIT_SYNC_ENABLED=true
GIT_SYNC_REPO=https://x-access-token:<GITHUB_TOKEN>@github.com/owner/repo.git
GIT_SYNC_BRANCH=main
GIT_SYNC_DIR=/app/repo
GIT_SYNC_INTERVAL_MS=60000
```

On boot the worker clones (shallow, single branch) into `GIT_SYNC_DIR`,
then every interval runs `git fetch && git reset --hard origin/<branch>`.
When new commits arrive, **auto-migrations re-run** so the DB schema
follows the latest `migrations/sql/*.up.sql` shipped in the repo.

> Note: pulled JS is **not** hot-reloaded into the running Node process.
> Restart the container to load new code. The worker is meant to keep
> deployed assets (migrations, seeds, configs) in sync.

---

## Project structure

```
nodejsapp/
├── migrations/
│   ├── sql/                   # versioned .up.sql / .down.sql
│   ├── migrate.js             # CLI runner
│   └── seed.js                # base data seeder
├── src/
│   ├── config/                # env, db pool, autoMigrate, gitSync, swagger
│   ├── middleware/            # requestId, requestLogger, auth, rateLimit, errorHandler
│   ├── routes/                # express routers (health, logs, auth, …)
│   ├── services/              # business logic
│   ├── validators/            # zod schemas
│   ├── sockets/               # socket.io handlers
│   ├── utils/                 # winston logger, log reader, ApiError, asyncHandler
│   ├── public/                # static log-viewer.html
│   ├── app.js                 # express app composition
│   └── server.js              # entry point (DB ping → migrate → listen)
├── schema.sql                 # full reference schema (informational)
├── Dockerfile                 # multi-stage, non-root, tini, healthcheck
├── docker-compose.yml         # api + postgres for local dev
├── .env.example               # documented env reference
└── package.json
```
