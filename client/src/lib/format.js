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

/**
 * "just now" / "4m ago" / "3h ago" / "2d ago" / "Mar 14" — for the notification
 * bell (§7.3), which needs finer grain than `relativeDays`.
 *
 * A notification from eleven minutes ago rendered as "today" tells the operator
 * nothing about whether they have already seen it. Past a week the relative
 * form stops helping and it falls back to a date.
 */
export function relativeTime(value) {
  if (!value) return '';
  const seconds = Math.round((new Date() - new Date(value)) / 1000);

  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 7 * 86_400) return `${Math.round(seconds / 86_400)}d ago`;
  return dateShort(value);
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

/**
 * A product name with its part type stripped off the end.
 *
 * `name` is stored as "<model> <part type>" ("OnePlus 10 Pro Earpiece Speaker")
 * because an order line, an invoice, a search result and an export all need the
 * part type inside the one string they print. The catalogue surfaces do not: the
 * card, the PDP and the cart line already show `partTypeLabel` in the eyebrow
 * directly above the name, so the full name repeated it a word later.
 *
 * The suffix is only removed when it really is a suffix and something is left
 * over — a bad label, a name that never carried it, or a product whose whole
 * name IS the part type all fall through to the untouched name.
 */
export function productTitle(name = '', partTypeLabel = '') {
  const label = partTypeLabel.trim();
  if (!label) return name;

  const trimmed = name.trim();
  if (trimmed.length <= label.length) return name;
  if (trimmed.slice(-label.length).toLowerCase() !== label.toLowerCase()) return name;

  const head = trimmed.slice(0, -label.length).trim();
  return head || name;
}
