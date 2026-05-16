#!/usr/bin/env node
/**
 * EcoBus V2 — Seed script (rich demo dataset).
 *
 * Idempotent. Safe to run multiple times.
 *
 * Seeds (per organization, x3 organizations):
 *   • RBAC: roles, permissions, role_permissions
 *   • Organizations (3 schools)
 *   • Users: 1 super_admin (global) + per-org: 1 admin, 1 manager, 3 drivers, 8 parents
 *   • Buses (4 per org), Routes (3 per org) with 4 stops each
 *   • Route assignments (route ↔ bus ↔ driver)
 *   • Children (12 per org) linked to parents and enrolled on routes
 *   • Trips (1 active + 2 completed per org)
 *   • GPS logs (50 pings per active trip + live status)
 *   • Stop events, check-ins, SOS alerts, notifications, system alerts
 *   • Geofences, device tokens
 *   • Analytics: visitors, sessions, page_views, events
 *
 * Default password for every demo user: `Admin@1234`
 *
 * Run:  npm run seed
 */
import bcrypt from 'bcrypt';
import { pool, query, withTransaction } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

const ROLES = ['super_admin', 'admin', 'school_manager', 'driver', 'parent'];

const PERMISSIONS = [
  'org.manage', 'org.read',
  'user.manage', 'user.read',
  'bus.manage', 'bus.read',
  'route.manage', 'route.read',
  'trip.manage', 'trip.read',
  'gps.write', 'gps.read',
  'child.manage', 'child.read',
  'checkin.write', 'checkin.read',
  'sos.trigger', 'sos.read',
  'alert.manage', 'alert.read',
  'geofence.manage', 'geofence.read',
  'notification.read',
  'analytics.read',
];

const ROLE_PERMS = {
  super_admin: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== 'org.manage'),
  school_manager: [
    'user.read', 'bus.manage', 'bus.read', 'route.manage', 'route.read',
    'trip.manage', 'trip.read', 'child.manage', 'child.read',
    'checkin.read', 'analytics.read', 'notification.read',
    'alert.read', 'geofence.read',
  ],
  driver: [
    'route.read', 'trip.read', 'gps.write', 'checkin.write', 'checkin.read',
    'sos.trigger', 'notification.read',
  ],
  parent: [
    'child.read', 'trip.read', 'gps.read', 'checkin.read',
    'sos.trigger', 'notification.read',
  ],
};

const DEMO_PASSWORD = 'Admin@1234';

const DEMO_ORGS = [
  { key: 'demo', name: 'Demo School', contact_email: 'admin@ecobus.demo',
    phone: '+216 70 000 000', address: '12 Avenue Habib Bourguiba, Tunis',
    plan: 'pro', status: 'active', centerLat: 36.8065, centerLng: 10.1815 },
  { key: 'sunshine', name: 'Sunshine Academy', contact_email: 'admin@sunshine.demo',
    phone: '+216 71 222 333', address: '45 Rue de Carthage, Tunis',
    plan: 'starter', status: 'trial', centerLat: 36.8525, centerLng: 10.1956 },
  { key: 'horizon', name: 'Horizon International School', contact_email: 'admin@horizon.demo',
    phone: '+216 72 444 555', address: '8 Boulevard de l\'Environnement, Sousse',
    plan: 'enterprise', status: 'active', centerLat: 35.8256, centerLng: 10.6411 },
];

const DRIVER_NAMES = [
  ['Karim', 'Bouazizi'], ['Ahmed', 'Trabelsi'], ['Mohamed', 'Sassi'],
  ['Youssef', 'Khelifi'], ['Walid', 'Ben Salah'], ['Anis', 'Gharbi'],
  ['Slim', 'Hamdi'], ['Riadh', 'Mansouri'], ['Hatem', 'Jebali'],
];

const PARENT_NAMES = [
  ['Leila', 'Fessi'], ['Sonia', 'Mejri'], ['Rim', 'Bouzid'],
  ['Nadia', 'Chaabane'], ['Imen', 'Karoui'], ['Sarra', 'Rebai'],
  ['Hanen', 'Lahmar'], ['Mariem', 'Ayadi'], ['Asma', 'Triki'],
  ['Olfa', 'Brahmi'], ['Wafa', 'Saidi'], ['Donia', 'Belhaj'],
  ['Hela', 'Maaloul'], ['Amina', 'Zouari'], ['Fatma', 'Hamdouni'],
  ['Houda', 'Romdhane'], ['Salma', 'Cherif'], ['Yosra', 'Mabrouk'],
  ['Ines', 'Mhiri'], ['Sirine', 'Khalfaoui'], ['Henda', 'Ouni'],
  ['Sabrine', 'Marouani'], ['Wissal', 'Hadj'], ['Abir', 'Mtiri'],
];

const CHILD_FIRST = [
  'Yasmine', 'Adam', 'Lina', 'Rayan', 'Mariem', 'Aziz', 'Nour', 'Iyed',
  'Maya', 'Zayd', 'Eya', 'Mehdi', 'Sara', 'Ali', 'Selma', 'Anas',
  'Aya', 'Omar', 'Lilya', 'Habib', 'Farah', 'Iyad', 'Cyrine', 'Skander',
  'Maram', 'Aymen', 'Tasnim', 'Bilel', 'Nesrine', 'Rami', 'Mayssa', 'Khalil',
  'Rania', 'Wassim', 'Dorra', 'Akram',
];

const BUS_PLATES = [
  '123 TUN 4567', '456 TUN 7890', '789 TUN 1234', '321 TUN 6543',
  '654 TUN 9876', '987 TUN 3210', '111 TUN 2222', '333 TUN 4444',
  '555 TUN 6666', '777 TUN 8888', '999 TUN 1010', '212 TUN 1313',
];

const upsertRole = async (c, name) => {
  const { rows } = await c.query(
    `INSERT INTO roles (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [name]);
  return rows[0].id;
};

const upsertPermission = async (c, name) => {
  const { rows } = await c.query(
    `INSERT INTO permissions (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [name]);
  return rows[0].id;
};

const ensureOrg = async (c, o) => {
  const existing = await c.query(
    'SELECT id FROM organizations WHERE contact_email = $1', [o.contact_email]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const { rows } = await c.query(
    `INSERT INTO organizations (name, contact_email, phone, address, subscription_plan, subscription_status)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [o.name, o.contact_email, o.phone, o.address, o.plan, o.status]);
  return rows[0].id;
};

const ensureUser = async (c, orgId, hash, u) => {
  const existing = await c.query('SELECT id FROM users WHERE email = $1', [u.email]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const { rows } = await c.query(
    `INSERT INTO users (organization_id, first_name, last_name, email, phone, password_hash, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id`,
    [orgId, u.first_name, u.last_name, u.email, u.phone, hash]);
  return rows[0].id;
};

const grantRole = async (c, userId, roleId) =>
  c.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [userId, roleId]);

const ensureBus = async (c, orgId, b) => {
  const existing = await c.query(
    'SELECT id FROM buses WHERE organization_id = $1 AND plate_number = $2',
    [orgId, b.plate_number]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const { rows } = await c.query(
    `INSERT INTO buses (organization_id, name, plate_number, capacity, status)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [orgId, b.name, b.plate_number, b.capacity, b.status]);
  return rows[0].id;
};

const ensureRoute = async (c, orgId, r) => {
  const existing = await c.query(
    'SELECT id FROM routes WHERE organization_id = $1 AND name = $2', [orgId, r.name]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const { rows } = await c.query(
    `INSERT INTO routes (organization_id, name, description, is_active)
     VALUES ($1,$2,$3,TRUE) RETURNING id`,
    [orgId, r.name, r.description]);
  return rows[0].id;
};

const ensureStop = async (c, routeId, s) => {
  const existing = await c.query(
    'SELECT id FROM route_stops WHERE route_id = $1 AND stop_order = $2',
    [routeId, s.stop_order]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const { rows } = await c.query(
    `INSERT INTO route_stops (route_id, name, latitude, longitude, stop_order, planned_time)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [routeId, s.name, s.latitude, s.longitude, s.stop_order, s.planned_time]);
  return rows[0].id;
};

const ensureChild = async (c, orgId, parentId, ch) => {
  const existing = await c.query(
    `SELECT id FROM children
     WHERE organization_id = $1 AND parent_id = $2 AND first_name = $3 AND last_name = $4`,
    [orgId, parentId, ch.first_name, ch.last_name]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const { rows } = await c.query(
    `INSERT INTO children (organization_id, first_name, last_name, date_of_birth, parent_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [orgId, ch.first_name, ch.last_name, ch.date_of_birth, parentId]);
  return rows[0].id;
};

const ensureAssignment = async (c, orgId, routeId, busId, driverId) => {
  const existing = await c.query(
    `SELECT id FROM route_assignments
     WHERE organization_id = $1 AND route_id = $2 AND bus_id = $3 AND driver_id = $4`,
    [orgId, routeId, busId, driverId]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const { rows } = await c.query(
    `INSERT INTO route_assignments (organization_id, route_id, bus_id, driver_id, start_date, is_active)
     VALUES ($1,$2,$3,$4,CURRENT_DATE,TRUE) RETURNING id`,
    [orgId, routeId, busId, driverId]);
  return rows[0].id;
};

const ensureChildRoute = async (c, childId, routeId, pickupId, dropoffId) => {
  const existing = await c.query('SELECT id FROM child_routes WHERE child_id = $1', [childId]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const { rows } = await c.query(
    `INSERT INTO child_routes (child_id, route_id, pickup_stop_id, dropoff_stop_id)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [childId, routeId, pickupId, dropoffId]);
  return rows[0].id;
};

const buildRoute = (org, idx) => {
  const labels = ['Morning North Loop', 'Morning South Loop', 'Afternoon Drop-off'];
  const offsets = [
    [[ 0.045, -0.020], [ 0.030, -0.005], [ 0.015,  0.010], [0, 0]],
    [[-0.040, -0.030], [-0.025, -0.015], [-0.012,  0.000], [0, 0]],
    [[0, 0], [-0.020,  0.025], [-0.038,  0.045], [-0.055,  0.060]],
  ];
  const times = [
    ['07:10:00', '07:25:00', '07:40:00', '07:55:00'],
    ['07:15:00', '07:30:00', '07:45:00', '08:00:00'],
    ['16:00:00', '16:15:00', '16:30:00', '16:45:00'],
  ];
  return {
    name: `${labels[idx]} — ${org.name}`,
    description: `Auto-generated demo route ${idx + 1} for ${org.name}`,
    stops: offsets[idx].map((delta, i) => ({
      name: (i === offsets[idx].length - 1 && idx < 2) || (i === 0 && idx === 2)
        ? 'School Gate' : `Stop ${i + 1}`,
      latitude: org.centerLat + delta[0],
      longitude: org.centerLng + delta[1],
      stop_order: i + 1,
      planned_time: times[idx][i],
    })),
  };
};

const lerp = (a, b, t) => a + (b - a) * t;

const seed = async () => {
  const hash = await bcrypt.hash(DEMO_PASSWORD, env.bcryptRounds);

  await withTransaction(async (c) => {
    const roleIds = {};
    for (const name of ROLES) roleIds[name] = await upsertRole(c, name);
    const permIds = {};
    for (const name of PERMISSIONS) permIds[name] = await upsertPermission(c, name);
    for (const [role, perms] of Object.entries(ROLE_PERMS)) {
      for (const p of perms) {
        await c.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [roleIds[role], permIds[p]]);
      }
    }
    logger.info(`Seeded ${ROLES.length} roles & ${PERMISSIONS.length} permissions`);

    const firstOrgId = await ensureOrg(c, DEMO_ORGS[0]);
    const superId = await ensureUser(c, firstOrgId, hash, {
      first_name: 'Root', last_name: 'Admin',
      email: 'root@ecobus.demo', phone: '+216 20 000 001',
    });
    await grantRole(c, superId, roleIds.super_admin);

    let parentNameCursor = 0, driverNameCursor = 0, busPlateCursor = 0, childNameCursor = 0;

    for (const org of DEMO_ORGS) {
      const orgId = org.key === DEMO_ORGS[0].key ? firstOrgId : await ensureOrg(c, org);

      const adminId = await ensureUser(c, orgId, hash, {
        first_name: 'Admin', last_name: org.name.split(' ')[0],
        email: `admin@${org.key}.demo`,
        phone: `+216 20 100 ${String(DEMO_ORGS.indexOf(org)).padStart(3, '0')}`,
      });
      await grantRole(c, adminId, roleIds.admin);

      const managerId = await ensureUser(c, orgId, hash, {
        first_name: 'Manager', last_name: org.name.split(' ')[0],
        email: `manager@${org.key}.demo`,
        phone: `+216 20 200 ${String(DEMO_ORGS.indexOf(org)).padStart(3, '0')}`,
      });
      await grantRole(c, managerId, roleIds.school_manager);

      const driverIds = [];
      for (let i = 0; i < 3; i++) {
        const [fn, ln] = DRIVER_NAMES[driverNameCursor++ % DRIVER_NAMES.length];
        const id = await ensureUser(c, orgId, hash, {
          first_name: fn, last_name: ln,
          email: `driver${i + 1}@${org.key}.demo`,
          phone: `+216 21 ${String(driverNameCursor).padStart(3, '0')} 000`,
        });
        await grantRole(c, id, roleIds.driver);
        driverIds.push(id);
      }

      const parentIds = [];
      for (let i = 0; i < 8; i++) {
        const [fn, ln] = PARENT_NAMES[parentNameCursor++ % PARENT_NAMES.length];
        const id = await ensureUser(c, orgId, hash, {
          first_name: fn, last_name: ln,
          email: `parent${i + 1}@${org.key}.demo`,
          phone: `+216 22 ${String(parentNameCursor).padStart(3, '0')} 000`,
        });
        await grantRole(c, id, roleIds.parent);
        parentIds.push(id);
      }

      if (org.key === 'demo') {
        const legacyDriver = await ensureUser(c, orgId, hash, {
          first_name: 'Karim', last_name: 'Driver',
          email: 'driver@ecobus.demo', phone: '+216 20 000 004',
        });
        await grantRole(c, legacyDriver, roleIds.driver);
        driverIds.push(legacyDriver);

        const legacyParent = await ensureUser(c, orgId, hash, {
          first_name: 'Leila', last_name: 'Parent',
          email: 'parent@ecobus.demo', phone: '+216 20 000 005',
        });
        await grantRole(c, legacyParent, roleIds.parent);
        parentIds.push(legacyParent);
      }

      const busIds = [];
      for (let i = 0; i < 4; i++) {
        const id = await ensureBus(c, orgId, {
          name: `Bus ${String.fromCharCode(65 + i)} (${org.name.split(' ')[0]})`,
          plate_number: BUS_PLATES[busPlateCursor++ % BUS_PLATES.length],
          capacity: 25 + i * 5,
          status: i === 0 ? 'active' : i === 3 ? 'maintenance' : 'inactive',
        });
        busIds.push(id);
      }

      const routeData = [];
      for (let i = 0; i < 3; i++) {
        const r = buildRoute(org, i);
        const routeId = await ensureRoute(c, orgId, r);
        const stopIds = [];
        for (const s of r.stops) stopIds.push(await ensureStop(c, routeId, s));
        routeData.push({ routeId, stopIds, stops: r.stops });
      }

      const asg0 = await ensureAssignment(c, orgId, routeData[0].routeId, busIds[0], driverIds[0]);
      const asg1 = await ensureAssignment(c, orgId, routeData[1].routeId, busIds[1], driverIds[1]);
      await ensureAssignment(c, orgId, routeData[2].routeId, busIds[2], driverIds[2 % driverIds.length]);

      const childIds = [];
      for (let i = 0; i < 12; i++) {
        const parentId = parentIds[i % parentIds.length];
        const fn = CHILD_FIRST[childNameCursor++ % CHILD_FIRST.length];
        const ln = PARENT_NAMES[(parentNameCursor + i) % PARENT_NAMES.length][1];
        const childId = await ensureChild(c, orgId, parentId, {
          first_name: fn, last_name: ln,
          date_of_birth: `201${5 + (i % 5)}-0${(i % 9) + 1}-1${i % 9}`,
        });
        const route = routeData[i % 2];
        const dropoff = routeData[2];
        await ensureChildRoute(c, childId, route.routeId,
          route.stopIds[i % route.stopIds.length],
          dropoff.stopIds[dropoff.stopIds.length - 1]);
        childIds.push(childId);
      }

      const now = new Date();
      const existingTrips = await c.query(
        'SELECT COUNT(*)::int AS n FROM trips WHERE organization_id = $1', [orgId]);

      if (existingTrips.rows[0].n === 0) {
        const mkTrip = async (assignmentId, routeId, status, startMinAgo, endMinAgo) => {
          const startTime = new Date(now.getTime() - startMinAgo * 60_000);
          const endTime = endMinAgo == null ? null : new Date(now.getTime() - endMinAgo * 60_000);
          const { rows } = await c.query(
            `INSERT INTO trips (organization_id, route_id, assignment_id, status, start_time, end_time)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [orgId, routeId, assignmentId, status, startTime, endTime]);
          return rows[0].id;
        };

        const tActive = await mkTrip(asg0, routeData[0].routeId, 'active', 25, null);
        const tDone1  = await mkTrip(asg0, routeData[0].routeId, 'completed', 24 * 60, 23 * 60);
        const tDone2  = await mkTrip(asg1, routeData[1].routeId, 'completed', 26 * 60, 25 * 60);

        const r0 = routeData[0];
        const segs = r0.stops.length - 1;
        for (let i = 0; i < 50; i++) {
          const t = i / 49;
          const segIdx = Math.min(segs - 1, Math.floor(t * segs));
          const localT = (t * segs) - segIdx;
          const a = r0.stops[segIdx]; const b = r0.stops[segIdx + 1];
          const lat = lerp(a.latitude, b.latitude, localT);
          const lng = lerp(a.longitude, b.longitude, localT);
          const recordedAt = new Date(now.getTime() - (50 - i) * 30_000);
          await c.query(
            `INSERT INTO gps_logs (trip_id, bus_id, latitude, longitude, speed, heading, accuracy, battery_level, recorded_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [tActive, busIds[0], lat, lng, 25 + (i % 15),
             (i * 7) % 360, 5 + (i % 10), 90 - Math.floor(i / 5), recordedAt]);
        }

        const last = r0.stops[r0.stops.length - 1];
        await c.query(
          `INSERT INTO bus_live_status
             (bus_id, trip_id, latitude, longitude, speed, heading, accuracy, battery_level, gps_status, last_update, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ok',NOW(),NOW())
           ON CONFLICT (bus_id) DO UPDATE SET
             trip_id=EXCLUDED.trip_id, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
             speed=EXCLUDED.speed, heading=EXCLUDED.heading, accuracy=EXCLUDED.accuracy,
             battery_level=EXCLUDED.battery_level, gps_status='ok', last_update=NOW(), updated_at=NOW()`,
          [busIds[0], tActive, last.latitude, last.longitude, 30, 90, 5, 80]);

        for (let i = 0; i < r0.stops.length; i++) {
          const arrival = new Date(now.getTime() - (24 * 60 - i * 10) * 60_000);
          const departure = new Date(arrival.getTime() + 60_000);
          await c.query(
            `INSERT INTO stop_events (trip_id, stop_id, arrival_time, departure_time, status)
             VALUES ($1,$2,$3,$4,'completed')`,
            [tDone1, r0.stopIds[i], arrival, departure]);
        }

        for (let i = 0; i < Math.min(6, childIds.length); i++) {
          await c.query(
            `INSERT INTO checkins (trip_id, child_id, status, method, timestamp)
             VALUES ($1,$2,$3,$4, NOW() - ($5 || ' minutes')::interval)`,
            [tActive, childIds[i],
             i === 5 ? 'absent' : 'boarded',
             i % 2 === 0 ? 'qr' : 'manual',
             String(20 - i * 2)]);
        }

        // also seed a few checkins on tDone2 for coverage
        for (let i = 0; i < 3; i++) {
          await c.query(
            `INSERT INTO checkins (trip_id, child_id, status, method, timestamp)
             VALUES ($1,$2,'boarded','manual', NOW() - INTERVAL '1 day')`,
            [tDone2, childIds[i]]);
        }
      }

      for (let i = 0; i < parentIds.length; i++) {
        const exists = await c.query(
          'SELECT 1 FROM notifications WHERE user_id = $1 LIMIT 1', [parentIds[i]]);
        if (exists.rowCount > 0) continue;
        await c.query(
          `INSERT INTO notifications (user_id, title, message, type, is_read)
           VALUES
            ($1,'Trip started','Your child''s bus has started the morning route','trip', FALSE),
            ($1,'Boarded','Your child boarded the bus at Stop 1','checkin', TRUE),
            ($1,'Arrived at school','The bus reached the school gate','trip', FALSE)`,
          [parentIds[i]]);
      }

      for (let i = 0; i < parentIds.length; i++) {
        const exists = await c.query(
          'SELECT 1 FROM device_tokens WHERE user_id = $1 LIMIT 1', [parentIds[i]]);
        if (exists.rowCount > 0) continue;
        await c.query(
          `INSERT INTO device_tokens (user_id, token, platform) VALUES ($1,$2,$3)`,
          [parentIds[i],
           `demo-fcm-token-${org.key}-${i}-${Math.random().toString(36).slice(2, 10)}`,
           i % 2 === 0 ? 'android' : 'ios']);
      }

      const sosExists = await c.query(
        `SELECT 1 FROM sos_alerts s JOIN users u ON u.id = s.user_id
         WHERE u.organization_id = $1 LIMIT 1`, [orgId]);
      if (sosExists.rowCount === 0) {
        await c.query(
          `INSERT INTO sos_alerts (user_id, latitude, longitude, status, created_at)
           VALUES ($1,$2,$3,'resolved', NOW() - INTERVAL '2 days')`,
          [driverIds[0], org.centerLat + 0.01, org.centerLng - 0.01]);
      }

      const alertExists = await c.query(
        'SELECT 1 FROM alerts WHERE organization_id = $1 LIMIT 1', [orgId]);
      if (alertExists.rowCount === 0) {
        await c.query(
          `INSERT INTO alerts (organization_id, type, severity, bus_id, message)
           VALUES
            ($1,'gps_offline','warning',$2,'Bus has been offline for 2 minutes'),
            ($1,'speeding','critical',$2,'Bus exceeded 80 km/h on residential road'),
            ($1,'maintenance','info',$3,'Scheduled maintenance due in 7 days')`,
          [orgId, busIds[0], busIds[3]]);
      }

      const gfExists = await c.query(
        'SELECT 1 FROM geofences WHERE organization_id = $1 LIMIT 1', [orgId]);
      if (gfExists.rowCount === 0) {
        await c.query(
          `INSERT INTO geofences (organization_id, name, latitude, longitude, radius)
           VALUES ($1,'School Perimeter',$2,$3,200),
                  ($1,'Bus Depot',$4,$5,150)`,
          [orgId, org.centerLat, org.centerLng,
           org.centerLat + 0.05, org.centerLng + 0.05]);
      }

      const visitsExists = await c.query(
        `SELECT 1 FROM visitors v WHERE v.user_id IN
           (SELECT id FROM users WHERE organization_id = $1) LIMIT 1`, [orgId]);
      if (visitsExists.rowCount === 0) {
        for (let i = 0; i < 5; i++) {
          const userId = parentIds[i % parentIds.length];
          const v = await c.query(
            `INSERT INTO visitors (user_id, ip_address, user_agent, country, city)
             VALUES ($1,$2,$3,'Tunisia','Tunis') RETURNING id`,
            [userId, `196.0.0.${i + 10}`, 'Mozilla/5.0 (demo)']);
          const s = await c.query(
            `INSERT INTO sessions (visitor_id, device_type, platform, started_at, ended_at)
             VALUES ($1,$2,$3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours')
             RETURNING id`,
            [v.rows[0].id,
             i % 2 === 0 ? 'mobile' : 'desktop',
             i % 2 === 0 ? 'android' : 'web']);
          await c.query(
            `INSERT INTO page_views (session_id, page, title, duration)
             VALUES ($1,'/dashboard','Dashboard',60),
                    ($1,'/tracking','Live Tracking',180),
                    ($1,'/children','My Children',45)`,
            [s.rows[0].id]);
          await c.query(
            `INSERT INTO events (session_id, user_id, event_type, metadata)
             VALUES ($1,$2,'page_view','{"path":"/dashboard"}'::jsonb),
                    ($1,$2,'tracking_open','{"bus":"A"}'::jsonb)`,
            [s.rows[0].id, userId]);
        }
      }

      logger.info(`✓ Org "${org.name}" seeded`);
    }
  });
};

const seedSafe = async () => {
  const { rows } = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'children' AND column_name = 'organization_id'`);
  if (rows.length === 0) {
    logger.warn('children.organization_id missing — adding it before seeding');
    await query(
      `ALTER TABLE children
         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE`);
  }
  await seed();
};

export { seedSafe, seed, DEMO_ORGS, DEMO_PASSWORD };

// Only auto-run when invoked directly via `node migrations/seed.js`,
// not when imported by the dev seed endpoint.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedSafe()
    .then(() => {
      logger.info('========================================');
      logger.info('Rich seed complete. Demo credentials (password = Admin@1234):');
      logger.info('  super_admin → root@ecobus.demo');
      for (const o of DEMO_ORGS) {
        logger.info(`  [${o.name}]`);
        logger.info(`    admin    → admin@${o.key}.demo`);
        logger.info(`    manager  → manager@${o.key}.demo`);
        logger.info(`    drivers  → driver1@${o.key}.demo .. driver3@${o.key}.demo`);
        logger.info(`    parents  → parent1@${o.key}.demo .. parent8@${o.key}.demo`);
      }
      logger.info('  Legacy logins kept: driver@ecobus.demo / parent@ecobus.demo');
      logger.info('========================================');
    })
    .catch((err) => {
      logger.error('Seed failed', { err: err.message, stack: err.stack });
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
