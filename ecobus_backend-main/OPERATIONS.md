# EcoBus V2 — Backend Operations Guide

> **Audience:** technical owners and operations teams running the EcoBus V2
> backend in production. Pair this guide with `DEPLOY.md` (one-command install)
> and the live OpenAPI explorer at `https://<your-domain>/api/docs`.

---

## 1. What the backend does

EcoBus V2 is a **multi-tenant real-time school-bus tracking platform**. The
Node.js API powers four products from a single codebase:

| Product | Real-time capabilities |
|---|---|
| Parent app | Live bus map, ETA, stop-arrival push, SOS receive, child check-in feed |
| Driver app | GPS publish, trip start/end, child boarding, SOS trigger |
| School dashboard | Fleet view, route management, alerts, analytics |
| Admin console | Tenant onboarding, role assignment, audit trail |

All four talk to the **same REST + WebSocket API** documented under `/api/docs`.
Tenancy is enforced server-side via `organization_id` on every query — no
cross-school data leak is possible by design.

---

## 2. Capacity & scaling at a glance

| Dimension | Single-node target (4 vCPU / 8 GB) | How to scale further |
|---|---|---|
| Active buses streaming GPS | **5 000+** at one ping / 3 s | Add API nodes + Redis adapter (§ 7) |
| Concurrent WebSocket clients | **20 000+** | Same as above |
| GPS pings / sec | **~1 600** sustained | DB tier upgrade + read replicas |
| REST requests / sec | **~2 000** mixed | PM2 cluster mode + Nginx upstreams |
| Stop-arrival fan-outs / sec | Bound by Postgres write IOPS | Bulk insert path (already enabled) |

These numbers come from the architecture choices below — not from a marketing
sheet. They hold as long as Postgres has SSD storage and ≥4 vCPU.

---

## 3. The GPS hot path — how each ping is processed

Every ping a driver phone sends goes through this pipeline. End-to-end budget
is **< 50 ms** on a healthy node.

```
Driver phone
    │  POST /api/v1/tracking/location  (≤ 1 ping per bus per 3 s)
    ▼
1.  Per-bus rate limiter            → rejects floods at the edge (in-memory)
2.  Zod validation                  → ensures lat/lng/speed are sane
3.  Active-trip authorization       → 1 SQL: bus∈org, trip in_progress, driver matches
4.  Single transaction:
       • INSERT gps_logs            → append-only history (indexed bus_id+time)
       • UPSERT bus_live_status     → one row per bus, always current
       • Stop arrival detection     → 75 m radius, partial-unique index dedupes
5.  202 Accepted returned NOW       → driver loop never waits on fan-out
6.  Async fan-out (off response):
       • WebSocket → bus:{id}, trip:{id}, org:{id}
       • For each arrival:
            – ONE SELECT joins child_routes to find every impacted parent
            – ONE bulk INSERT writes all parent notifications
            – ONE FCM batch push   (chunked at 500 tokens server-side)
            – Per-parent user:{id} socket emit
```

**Why this scales:**
- The driver never blocks on database fan-out.
- Parent notifications use `INSERT … VALUES (…),(…),(…)` so 30 parents at one
  stop = **1 round-trip**, not 30.
- `bus_live_status` is a single upserted row per bus, so the school map query
  is `O(buses)`, not `O(pings)`.

---

## 4. How parents receive updates (perfectly)

Two delivery channels, used together for reliability:

### 4.1 WebSocket (live map + instant arrivals)

Parents connect to `wss://<your-domain>/ws` with their JWT. The server
**auto-joins them to `org:{their-org}` and `user:{their-id}`** rooms. They can
optionally subscribe to a specific `bus:{id}` or `trip:{id}` room to get every
ping for that bus.

| Event | Sent to | Triggered by |
|---|---|---|
| `bus.location.updated` | `bus:{id}`, `trip:{id}`, `org:{id}` | Every accepted GPS ping |
| `stop.arrived` | `trip:{id}`, `bus:{id}`, `org:{id}` | First ping inside 75 m of a stop |
| `stop.arrived` (personal) | `user:{parentId}` | Same, but only to parents whose child uses that stop |
| `sos.triggered` / `sos.resolved` | `org:{id}`, `trip:{id}`, `bus:{id}`, recipient `user:{id}` rooms | SOS endpoints |
| `trip.started` / `trip.ended` | `org:{id}`, `trip:{id}` | Driver trip lifecycle |

### 4.2 Push notifications (background / offline)

When the parent app is backgrounded or offline, **Firebase Cloud Messaging**
delivers the same arrival/SOS events via `device_tokens`. Tokens are
deduplicated per-user, and stale tokens are removed automatically when FCM
returns `NotRegistered`.

### 4.3 What the parent actually sees

1. **Bus is on the way** → live blue dot moves on the map (WebSocket).
2. **Bus < 75 m from their stop** → in-app banner + push notification:
   *"The bus has reached Rue de Carthage."*
3. **Child boards** → driver scan creates a `checkin` row, parent receives
   *"Yacine boarded bus #12."*
4. **SOS triggered** → critical push and red banner across all parents whose
   child is currently boarded on that trip.

---

## 5. Multi-tenancy & security model

- Every domain table carries `organization_id`. Every query filters on it via
  `req.user.organizationId` — **set at JWT issue time, never trusted from the
  client.**
- Role checks use a dedicated `user_roles` table joined through
  `requireRole('admin', 'school_manager', …)` middleware. Roles are loaded
  once per request in `requireAuth` to avoid repeated lookups.
- `helmet`, strict CORS, JSON body limit `1 MB`, `x-powered-by` disabled.
- All passwords hashed with bcrypt (12 rounds). Refresh tokens are single-use
  and rotated on every refresh; revoked tokens are blacklisted in DB.
- SQL is **always parameterised** — no string concatenation anywhere.
- Sensitive endpoints (SOS resolve, fleet mutations, user admin) are guarded
  by both authentication and role.

---

## 6. Database — what makes it fast

| Table | Hot index | Purpose |
|---|---|---|
| `gps_logs` | `(bus_id, recorded_at DESC)`, `(trip_id, recorded_at DESC)` | History scans by bus or trip |
| `bus_live_status` | PK `bus_id`, `last_update` | Fleet map + offline detection |
| `stop_events` | partial unique `(trip_id, stop_id) WHERE arrival_time IS NOT NULL` | Idempotent arrival writes |
| `notifications` | `(user_id, created_at DESC)` | Parent inbox |
| `route_assignments` | unique `(bus_id) WHERE is_active` | One active assignment per bus |
| `trips` | `(organization_id, status)`, `(assignment_id, status)` | Active-trip resolution on every ping |
| `user_roles` | `(user_id)`, `(role_id)` | Role check on every request |

All migrations live under `nodejsapp/migrations/sql/` and are applied by
`npm run migrate` (or automatically at server start when `AUTO_MIGRATE=true`).

### Recommended Postgres settings

For 5 000 active buses, set on your DB instance (managed providers expose
these in their console):

```
shared_buffers           = 25% of RAM
work_mem                 = 16MB
effective_cache_size     = 75% of RAM
max_connections          = 200      # pair with PG_POOL_MAX = 20 per API node
random_page_cost         = 1.1      # SSD
```

---

## 7. Horizontal scaling (when you outgrow one node)

The single-node setup handles thousands of buses. When you need more:

1. **Provision Redis** (managed: Upstash, ElastiCache, Render Redis).
2. Add `REDIS_URL=redis://…` to `.env`.
3. Restart: `pm2 reload ecobus-api --update-env`.
4. The server **auto-attaches the Socket.IO Redis adapter** (`src/sockets/io.js`).
5. Run multiple PM2 workers or add more API nodes behind Nginx — every node
   now sees every WebSocket event.
6. Optional: switch `ecosystem.config.cjs` to `exec_mode: 'cluster'` and
   `instances: 'max'` to use all CPU cores on each node.

For the GPS rate limiter, swap the in-memory map in `gpsRateLimit.js` for a
Redis `SETEX` — the contract is documented in that file.

---

## 8. Observability

| Signal | Where |
|---|---|
| Structured JSON logs | stdout (captured by PM2 → `logs/pm2-*.log`) |
| Request correlation | `X-Request-Id` header, set by `requestId` middleware |
| Per-request access log | `requestLogger` middleware |
| In-app log viewer | `GET /api/v1/logs/viewer` (set `LOG_VIEWER_TOKEN`) |
| Live log stream | `GET /api/v1/logs/stream` (Server-Sent Events) |
| Health probe | `GET /api/v1/health` — returns DB ping + uptime |

For external monitoring, point UptimeRobot / BetterStack at `/api/v1/health`
and alert on > 1 min downtime.

---

## 9. Backup & disaster recovery

**Database:** managed Postgres providers (Neon, Supabase, RDS, Render) take
automatic daily snapshots — turn on point-in-time recovery for production.
For self-hosted Postgres, run nightly `pg_dump` to S3:

```bash
pg_dump "$DATABASE_URL" | gzip > /backups/ecobus-$(date +%F).sql.gz
aws s3 cp /backups/ecobus-$(date +%F).sql.gz s3://ecobus-backups/
```

**Application code:** lives in GitHub. Re-deploy on a fresh VPS in < 5 min
with `bash scripts/deploy.sh`.

**.env file:** treat as a secret. Keep an encrypted copy in a password
manager — losing it requires regenerating `JWT_SECRET` (logs out all users).

---

## 10. Day-2 operations cheat sheet

```bash
# Status
pm2 status
pm2 logs ecobus-api --lines 200
curl -s https://<your-domain>/api/v1/health | jq

# Pull latest code from GitHub (zero-downtime)
bash nodejsapp/scripts/update.sh

# Apply pending migrations only
cd nodejsapp && npm run migrate
npm run migrate:status

# Restart cleanly
pm2 reload ecobus-api --update-env

# Rotate JWT secret (will log everyone out)
sed -i 's/^JWT_SECRET=.*/JWT_SECRET='"$(node -e 'console.log(require("crypto").randomBytes(48).toString("hex"))')"'/' nodejsapp/.env
pm2 reload ecobus-api --update-env

# Tail GPS-only logs
pm2 logs ecobus-api | grep tracking/location

# Check active sockets
curl -s https://<your-domain>/api/v1/health/sockets   # if exposed
```

---

## 11. SLAs the design supports

| Metric | Target | Notes |
|---|---|---|
| GPS ingest p95 latency | < 50 ms | Excludes network RTT to driver |
| Map update visible to parent | < 1 s | Driver ping → WebSocket fan-out |
| Stop-arrival push delivered | < 5 s | Bound by FCM, not us |
| SOS notification delivered | < 3 s | WebSocket + push in parallel |
| API uptime | 99.9 %/month | Single-node + managed DB |
| Data durability | 99.999999999 % | Inherits from managed Postgres |

---

## 12. Frequently asked questions

**Q. Does each bus need a hardware tracker?**
No. The driver's smartphone is the GPS source. The API rejects pings if the
trip is not started, so drivers can't accidentally leak location off-duty.

**Q. What happens if a parent has weak signal?**
Push notifications are queued by FCM and delivered when the device reconnects.
The live map gracefully reconnects via the Socket.IO client and replays the
latest `bus_live_status` on resume.

**Q. Can a parent see another school's buses?**
No. Every read query filters by the parent's `organization_id`, set inside
the JWT at login. There is no API path that returns cross-tenant data.

**Q. What if the driver's phone uploads a duplicate stop arrival?**
The `uq_stop_events_trip_stop_arrival` partial unique index makes the insert
a no-op on conflict, so parents are never notified twice for the same stop.

**Q. How do you stop a malicious driver from spamming GPS?**
Three layers: (1) per-bus 3-second rate limiter at the edge, (2) JWT must
match the assigned driver, (3) global API rate limiter on the route prefix.

**Q. Where do I see the API documentation?**
`https://<your-domain>/api/docs` — interactive Swagger UI with request
examples, response schemas, and a built-in "Try it out" button. The raw
OpenAPI 3 spec is at `/api/docs.json`.

---

## 13. Support & escalation

1. Check `/api/v1/health` and `pm2 status`.
2. Tail logs: `pm2 logs ecobus-api --lines 500 | grep -i error`.
3. Verify DB reachability: `psql "$DATABASE_URL" -c 'select now()'`.
4. If migrations fail, run `npm run migrate:status` to see which step blocked.
5. Roll back the last code change with `git reset --hard HEAD~1 && bash scripts/update.sh`.

For deeper issues, open a ticket with: request ID (`X-Request-Id` header),
timestamp, endpoint, and the relevant log lines.
