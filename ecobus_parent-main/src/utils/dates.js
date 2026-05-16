/**
 * Tiny date helpers tailored for the absence flow.
 *
 * We avoid a full date-picker dependency for now and let the parent pick a
 * day from a horizontal strip. Everything is YYYY-MM-DD strings so dates
 * round-trip cleanly through the backend (which stores DATE columns).
 */
const pad = (n) => String(n).padStart(2, '0');

/** Convert a Date to YYYY-MM-DD in the device's local timezone. */
export const toYMD = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

/** Today as YYYY-MM-DD (local time). */
export const todayYMD = () => toYMD(new Date());

/** Add `n` days to a YYYY-MM-DD string and return the new YYYY-MM-DD. */
export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toYMD(dt);
};

/**
 * Build the next `count` days starting at `start` (inclusive) for the
 * day-strip picker. Each entry has `{ ymd, dayLabel, dateLabel }`.
 */
export const buildDayStrip = (count = 7, start = todayYMD(), locale) => {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const ymd = addDays(start, i);
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    out.push({
      ymd,
      dayLabel:  dt.toLocaleDateString(locale, { weekday: 'short' }),
      dateLabel: dt.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
    });
  }
  return out;
};

/** Human label for a date range (single day vs span). */
export const formatDateRange = (start, end, locale) => {
  if (!start) return '';
  const s = new Date(start);
  if (!end || end === start) {
    return s.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
  }
  const e = new Date(end);
  return `${s.toLocaleDateString(locale, { day: '2-digit', month: 'short' })} → ${e.toLocaleDateString(locale, { day: '2-digit', month: 'short' })}`;
};
