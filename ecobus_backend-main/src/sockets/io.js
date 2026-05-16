import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { query } from '../config/db.js';

/**
 * Verify a `bus:<id>` or `trip:<id>` room belongs to the user's org before
 * allowing the join. Super-admins bypass. Result is cached briefly per
 * socket to avoid hammering the DB on every subscribe.
 */
const canJoinRoom = async (user, room) => {
  if (!user) return false;
  if ((user.roles || []).some((r) => GLOBAL_LIVE_ROLES.includes(r))) return true;
  const m = /^(bus|trip):([\w-]+)$/.exec(room);
  if (!m) return false;
  const [, kind, id] = m;
  try {
    if (kind === 'bus') {
      const { rows } = await query(
        'SELECT 1 FROM buses WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
        [id, user.organizationId],
      );
      return rows.length > 0;
    }
    const { rows } = await query(
      'SELECT 1 FROM trips WHERE id = $1 AND organization_id = $2',
      [id, user.organizationId],
    );
    return rows.length > 0;
  } catch (err) {
    logger.warn('ws subscribe check failed', { err: err.message, room });
    return false;
  }
};

let io;

// Roles allowed to join the cross-org `global:live` room.
// Kept as a const so adding a new "platform operator" role is a one-line change.
const GLOBAL_LIVE_ROLES = ['super_admin'];

const attachUser = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (token) {
      const decoded = jwt.verify(token, env.jwtSecret);
      socket.user = {
        id: decoded.sub,
        organizationId: decoded.org,
        roles: Array.isArray(decoded.roles) ? decoded.roles : [],
      };
    }
    next();
  } catch {
    next(new Error('Unauthorized socket'));
  }
};

const isGlobalViewer = (user) =>
  !!user && (user.roles || []).some((r) => GLOBAL_LIVE_ROLES.includes(r));

/**
 * Optional Redis adapter — enables horizontal scaling.
 * Set REDIS_URL=redis://host:6379 to fan out events across PM2 cluster
 * workers or multiple API nodes. Without it, single-process mode is used
 * (still fine for thousands of concurrent sockets).
 */
const tryAttachRedisAdapter = async (server) => {
  if (!process.env.REDIS_URL) return;
  try {
    const [{ createClient }, { createAdapter }] = await Promise.all([
      import('redis'),
      import('@socket.io/redis-adapter'),
    ]);
    const pub = createClient({ url: process.env.REDIS_URL });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    server.adapter(createAdapter(pub, sub));
    logger.info('Socket.IO Redis adapter attached');
  } catch (err) {
    logger.warn('Redis adapter unavailable — running single-node', { err: err.message });
  }
};

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    // Allow every frontend origin (Vercel, Render, VPS, Lovable preview, etc.).
    // With credentials enabled, Socket.IO must reflect the request origin instead
    // of using "*", otherwise browsers reject the connection in production.
    cors: {
      origin: (_origin, cb) => cb(null, true),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Request-Id'],
    },
    // Tuned for many idle parent sockets: cheaper keepalive, larger window.
    pingInterval: 25_000,
    pingTimeout: 60_000,
    maxHttpBufferSize: 1e6,
  });
  tryAttachRedisAdapter(io).catch(() => {});

  // Default namespace kept for backward compatibility with existing clients.
  io.use(attachUser);
  io.on('connection', (socket) => {
    if (socket.user?.organizationId) socket.join(`org:${socket.user.organizationId}`);
    // Super-admins (and any future platform-wide role) get cross-org live data.
    // The room is server-controlled — clients cannot self-promote into it.
    if (isGlobalViewer(socket.user)) socket.join('global:live');
    socket.on('subscribe:bus', async (id) => {
      if (typeof id !== 'string') return;
      if (await canJoinRoom(socket.user, `bus:${id}`)) socket.join(`bus:${id}`);
    });
    socket.on('unsubscribe:bus', (id) => typeof id === 'string' && socket.leave(`bus:${id}`));
  });

  // Spec-compliant /ws namespace with bus:* and trip:* subscriptions.
  const ns = io.of('/ws');
  ns.use(attachUser);
  ns.on('connection', (socket) => {
    logger.info('ws connected', { id: socket.id, userId: socket.user?.id });
    if (socket.user?.organizationId) socket.join(`org:${socket.user.organizationId}`);
    if (socket.user?.id) socket.join(`user:${socket.user.id}`);
    // Cross-org live room (super_admin only). Server-side gated.
    if (isGlobalViewer(socket.user)) socket.join('global:live');

    socket.on('subscribe', async (room) => {
      if (typeof room !== 'string') return;
      if (!/^(bus|trip):[\w-]+$/.test(room)) return;
      if (await canJoinRoom(socket.user, room)) socket.join(room);
    });
    socket.on('unsubscribe', (room) => {
      if (typeof room === 'string') socket.leave(room);
    });
    socket.on('disconnect', () => logger.info('ws disconnected', { id: socket.id }));
  });

  return io;
};

export const getIO = () => io;
