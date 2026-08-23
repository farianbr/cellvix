/**
 * View-layer formatters. Money is stored and transported as integer cents
 * everywhere else in the system — this is the only place it becomes a string.
 */

const CAD = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
});

const CAD_COMPACT = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

/** 12995 -> "$129.95" */
export function money(cents) {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  return CAD.format(cents / 100);
}

/** 1299500 -> "$12,995" — for dashboard tiles where cents are noise. */
export function moneyCompact(cents) {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  return CAD_COMPACT.format(cents / 100);
}

const DATE_MED = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DATE_SHORT = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });

const DATE_TIME = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "Mar 14, 2026" */
export function date(value) {
  if (!value) return '—';
  return DATE_MED.format(new Date(value));
}

/** "Mar 14" */
export function dateShort(value) {
  if (!value) return '—';
  return DATE_SHORT.format(new Date(value));
}

/** "Mar 14, 2026, 3:20 p.m." */
export function dateTime(value) {
  if (!value) return '—';
  return DATE_TIME.format(new Date(value));
}

/** "in 6 days" / "3 days ago" / "today" */
export function relativeDays(value) {
  if (!value) return '—';
  const days = Math.round((new Date(value) - new Date()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/** 1240 -> "1,240" */
export function count(n) {
  if (n === null || n === undefined) return '0';
  return new Intl.NumberFormat('en-CA').format(n);
}

/** "samsung-s23-ultra" -> "Samsung S23 Ultra" (fallback only; prefer server-supplied names). */
export function titleize(slug = '') {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
