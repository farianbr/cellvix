/**
 * Shared display constants.
 *
 * BUSINESS_INFO is PLACEHOLDER DATA. Cellvix has not supplied real contact
 * details yet — see "Open questions" #1 in PROGRESS.md. Replace here only;
 * every surface (footer, contact tab, contact page) reads from this object.
 */

export const BUSINESS_INFO = {
  name: 'Cellvix',
  tagline: 'Repair with confidence',
  domain: 'cellvix.ca',
  // TODO(client): replace with real details
  phone: '+1 (000) 000-0000',
  email: 'sales@cellvix.ca',
  supportEmail: 'support@cellvix.ca',
  address: {
    line1: '000 Placeholder Rd, Unit 0',
    city: 'Toronto',
    region: 'ON',
    postal: 'M0M 0M0',
    country: 'Canada',
  },
  hours: [
    { days: 'Mon – Fri', time: '9:00 AM – 6:00 PM ET' },
    { days: 'Saturday', time: '10:00 AM – 4:00 PM ET' },
    { days: 'Sunday', time: 'Closed' },
  ],
  social: {
    facebook: '#',
    instagram: '#',
    linkedin: '#',
    youtube: '#',
  },
};

/** Condition grades, in the order they should ever be listed. */
export const GRADES = {
  NEW: { label: 'New', short: 'NEW', tone: 'ok' },
  OEM: { label: 'OEM', short: 'OEM', tone: 'info' },
  'PULL-A': { label: 'Pull Grade A', short: 'PULL A', tone: 'brand' },
  'PULL-B': { label: 'Pull Grade B', short: 'PULL B', tone: 'warn' },
  // `short` is split on spaces into the badge's lines. Two short lines read in a
  // circle; one long one does not — "AFTMKT" on a single line was wider than the
  // badge it sat in.
  AFTERMARKET: { label: 'Aftermarket', short: 'AFT MKT', tone: 'neutral' },
};

export const GRADE_ORDER = ['NEW', 'OEM', 'PULL-A', 'PULL-B', 'AFTERMARKET'];

/**
 * Low-stock threshold. ADMIN ONLY — it colours the inventory column in the
 * admin product list. The storefront states in stock or out of stock and never
 * sees a count at all; the API does not send one (productService.serialize).
 */
export const LOW_STOCK_THRESHOLD = 50;

/**
 * Labels are kept short on purpose: the sort control is a native <select> that
 * has to survive half a 375px row, and "Stock: most available" clipped under the
 * chevron there. Values are the API contract and must not change.
 */
export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'name-asc', label: 'Name: A–Z' },
  { value: 'price-asc', label: 'Price: low–high' },
  { value: 'price-desc', label: 'Price: high–low' },
  { value: 'stock-desc', label: 'In stock first' },
  { value: 'newest', label: 'Newest' },
];

/** The four levels of the shared filter hierarchy, in cascade order. */
export const FILTER_LEVELS = [
  { key: 'deviceType', label: 'Device Type', short: 'Device' },
  { key: 'brand', label: 'Brand', short: 'Brand' },
  { key: 'series', label: 'Series', short: 'Series' },
  { key: 'model', label: 'Model', short: 'Model' },
];

/** Order lifecycle, in the order the tracking stepper renders it. */
export const ORDER_STATUSES = [
  { value: 'placed', label: 'Order Placed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
];

export const PAGE_SIZE = 24;
