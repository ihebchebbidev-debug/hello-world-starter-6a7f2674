import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { seedSafe, DEMO_ORGS, DEMO_PASSWORD } from '../../migrations/seed.js';
import { query } from '../config/db.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * @openapi
 * /dev/seed:
 *   post:
 *     tags: [Dev]
 *     summary: Re-seed the demo dataset (idempotent)
 *     description: |
 *       Runs the rich demo seeder in-process. Safe to call repeatedly — every
 *       insert is gated by an existence check, so this will only fill in what is
 *       missing without duplicating rows.
 *
 *       **Created on a fresh database:**
 *       - 5 roles + ~24 permissions wired into `role_permissions`
 *       - 3 organizations (Demo School, Sunshine Academy, Horizon International)
 *       - 1 super_admin (`root@ecobus.demo`) plus per-org: 1 admin, 1 manager,
 *         3 drivers, 8 parents
 *       - Legacy logins kept: `admin@demo.demo`, `driver@ecobus.demo`,
 *         `parent@ecobus.demo` (all use password `Admin@1234`)
 *       - 4 buses + 3 routes (4 stops each) + route assignments per org
 *       - 12 children per org, each linked to a parent and route
 *       - 1 active trip + 2 completed trips per org with 50 GPS pings on the
 *         active trip and a `bus_live_status` row
 *
 *       **Returns** row counts after seeding so you can confirm what landed.
 *
 *       **No authentication is required** — this endpoint is intentionally
 *       open so the `/tests` runner can self-bootstrap. Disable or
 *       firewall it before going to real production.
 *     security: []
 *     requestBody:
 *       required: false
 *       description: No body required. Send an empty object or omit entirely.
 *       content:
 *         application/json:
 *           schema: { type: object }
 *           example: {}
 *     responses:
 *       200:
 *         description: Seed complete with row counts and demo credentials.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DevSeedResponse' }
 *             example:
 *               success: true
 *               message: OK
 *               data:
 *                 ok: true
 *                 durationMs: 2451
 *                 counts:
 *                   organizations: 3
 *                   users: 39
 *                   roles: 5
 *                   buses: 12
 *                   routes: 9
 *                   route_stops: 36
 *                   route_assignments: 9
 *                   children: 36
 *                   child_routes: 36
 *                   trips: 9
 *                   gps_logs: 150
 *                 demoPassword: Admin@1234
 *                 organizations:
 *                   - { key: demo, name: Demo School }
 *                   - { key: sunshine, name: Sunshine Academy }
 *                   - { key: horizon, name: Horizon International School }
 *                 logins:
 *                   super_admin: root@ecobus.demo
 *                   admin: admin@demo.demo
 *                   manager: manager@demo.demo
 *                   driver: driver@ecobus.demo
 *                   parent: parent@ecobus.demo
 *       500:
 *         description: Seed failed — typically a missing migration or DB outage.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example:
 *               success: false
 *               message: relation "users" does not exist
 *               error: relation "users" does not exist
 *               requestId: 03132e7f-7b91-47e2-bc26-ae10c3127690
 */
router.post(
  '/seed',
  asyncHandler(async (_req, res) => {
    const t0 = Date.now();
    logger.info('[dev] /dev/seed triggered');
    await seedSafe();
    const counts = {};
    const tables = [
      'organizations', 'users', 'roles', 'buses', 'routes', 'route_stops',
      'route_assignments', 'children', 'child_routes', 'trips', 'gps_logs',
    ];
    for (const t of tables) {
      try {
        const { rows } = await query(`SELECT COUNT(*)::int AS n FROM ${t}`);
        counts[t] = rows[0].n;
      } catch (e) {
        counts[t] = `error: ${e.message}`;
      }
    }
    res.json({
      ok: true,
      durationMs: Date.now() - t0,
      counts,
      demoPassword: DEMO_PASSWORD,
      organizations: DEMO_ORGS.map((o) => ({ key: o.key, name: o.name })),
      logins: {
        super_admin: 'root@ecobus.demo',
        admin: 'admin@demo.demo',
        manager: 'manager@demo.demo',
        driver: 'driver@ecobus.demo',
        parent: 'parent@ecobus.demo',
      },
    });
  }),
);

/**
 * @openapi
 * /dev/status:
 *   get:
 *     tags: [Dev]
 *     summary: Quick row-count snapshot to confirm seed state
 *     description: |
 *       Returns a small set of table counts plus the number of trips currently
 *       in the `active` status. Use this before running `/tests` to confirm the
 *       database has demo data, or right after `POST /dev/seed` to verify the
 *       seed actually inserted rows.
 *
 *       **No authentication is required.**
 *     security: []
 *     responses:
 *       200:
 *         description: Row-count snapshot.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DevStatusResponse' }
 *             example:
 *               success: true
 *               message: OK
 *               data:
 *                 counts:
 *                   organizations: 3
 *                   users: 39
 *                   buses: 12
 *                   routes: 9
 *                   trips: 9
 *                   children: 36
 *                 activeTrips: 3
 *       500:
 *         description: Database not reachable or required tables missing.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const tables = ['organizations', 'users', 'buses', 'routes', 'trips', 'children'];
    const counts = {};
    for (const t of tables) {
      const { rows } = await query(`SELECT COUNT(*)::int AS n FROM ${t}`);
      counts[t] = rows[0].n;
    }
    const { rows: activeTrips } = await query(
      `SELECT COUNT(*)::int AS n FROM trips WHERE status = 'active'`,
    );
    res.json({ counts, activeTrips: activeTrips[0].n });
  }),
);

export default router;
