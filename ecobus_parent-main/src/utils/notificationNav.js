/**
 * notificationTarget — derive a navigation target from a notification payload.
 *
 * The backend tags notifications with a `type` and frequently embeds the
 * related busId / tripId / childId in `data` (or as flat fields on legacy
 * payloads). This helper centralises the mapping so every list (Home recent
 * activity, full Notifications screen) navigates consistently when the user
 * taps a card.
 *
 * Returns either { screen, params } or null when the notification is purely
 * informational and has nowhere meaningful to navigate to.
 */
export function notificationTarget(item) {
  if (!item) return null;
  const data    = item.data || {};
  const busId   = item.busId   || data.busId   || data.bus_id;
  const tripId  = item.tripId  || data.tripId  || data.trip_id;
  const childId = item.childId || data.childId || data.child_id;
  const type    = item.type;

  if (type === 'sos' || type === 'emergency') {
    return { screen: 'Sos', params: {} };
  }
  if (busId || tripId) {
    // Anything tied to a live bus/trip → open the live tracking screen.
    return { screen: 'Tracking', params: { busId, tripId, child: childId ? { id: childId } : undefined } };
  }
  if (childId) {
    return { screen: 'ChildDetails', params: { childId } };
  }
  return null;
}
