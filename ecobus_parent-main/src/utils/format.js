/** Format helpers — keep currency/time logic in one place. */
export const formatCurrencyTND = (amount) => {
  const n = Number(amount || 0);
  return `${n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`;
};

export const formatTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

export const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch { return '—'; }
};

/**
 * Soft ETA formatter — avoids false precision from a noisy GPS-derived ETA.
 *
 * Rules (tuned with parents in mind — they care about "soon vs. not yet",
 * not whether it's 4 or 5 minutes):
 *   - null / NaN              → '—'
 *   - <= 1 minute             → "Arriving now"     (eta.now)
 *   - <= 5 minutes            → "Arriving soon"    (eta.soon)
 *   - 6–59 minutes            → "~{n} min"         (eta.approxMin)
 *   - >= 60 minutes           → "~{h}h {m}m"       (eta.approxHour / eta.approxHourMin)
 *
 * Always pass the i18n `t` function so the output is localized + RTL-safe.
 */
export const formatEta = (minutes, t) => {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n <= 1)  return t ? t('eta.now')  : 'Arriving now';
  if (n <= 5)  return t ? t('eta.soon') : 'Arriving soon';
  if (n < 60)  {
    const m = Math.round(n);
    return t ? t('eta.approxMin', { count: m }) : `~${m} min`;
  }
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  if (m === 0) return t ? t('eta.approxHour', { count: h }) : `~${h}h`;
  return t ? t('eta.approxHourMin', { h, m }) : `~${h}h ${m}m`;
};