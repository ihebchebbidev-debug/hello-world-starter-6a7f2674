import { io } from 'socket.io-client';
import { Auth, BASE_URL } from './api';

/**
 * Realtime bus tracking via Socket.IO.
 *
 * Connects to the backend's `/ws` namespace, authenticates with the access
 * token, and forwards `bus.location` / `trip.*` / `sos.*` events to the
 * caller-provided handlers. The screen owns reconnect / fallback UX.
 */

let socket = null;
const SERVER_ROOT = BASE_URL.replace(/\/api\/v1\/?$/, '');

export async function connectTracking({ busId, tripId } = {}, handlers = {}) {
  disconnectTracking();

  const token = await Auth.getAccessToken();

  socket = io(`${SERVER_ROOT}/ws`, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1500,
  });

  socket.on('connect', () => {
    if (busId)  socket.emit('subscribe', `bus:${busId}`);
    if (tripId) socket.emit('subscribe', `trip:${tripId}`);
    handlers.onConnect?.();
  });
  socket.on('disconnect',    (reason) => handlers.onDisconnect?.(reason));
  socket.on('connect_error', (err)    => handlers.onError?.(err));

  // Backend emits `bus.location.updated`; older builds used `bus.location`
  // and `bus:location`. Subscribe to all three so the parent UI never misses
  // a live ping regardless of backend version.
  const onLocation = (payload) => {
    if (!payload) return;
    // Backend payload uses `latitude`/`longitude`; the screen expects `lat`/`lng`.
    const lat = payload.lat ?? payload.latitude;
    const lng = payload.lng ?? payload.longitude;
    handlers.onLocation?.({
      ...payload,
      lat: lat == null ? null : Number(lat),
      lng: lng == null ? null : Number(lng),
      busId: payload.busId ?? payload.bus_id,
      tripId: payload.tripId ?? payload.trip_id,
      speed: payload.speed != null ? Number(payload.speed) : null,
      heading: payload.heading != null ? Number(payload.heading) : null,
    });
  };
  socket.on('bus.location.updated', onLocation);
  socket.on('bus.location', onLocation);
  socket.on('bus:location', onLocation);

  socket.on('trip.started', (p) => handlers.onTripStarted?.(p));
  socket.on('trip.ended',   (p) => handlers.onTripEnded?.(p));
  socket.on('trip.stopped', (p) => handlers.onTripEnded?.(p));
  socket.on('sos.triggered',(p) => handlers.onSos?.(p));

  return socket;
}

export function disconnectTracking() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
