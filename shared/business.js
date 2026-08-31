/**
 * The seller's own details — the one place they are written down.
 *
 * PLACEHOLDER DATA. Cellvix has not supplied real contact details yet — see
 * "Open questions" #1 in PROGRESS.md. Replace here only: the footer, contact
 * tab, contact page and the invoice document the server emails all read this
 * object, client and server alike.
 */
const BUSINESS_INFO = {
  name: 'Cellvix',
  tagline: 'Repair with confidence',
  domain: 'cellvix.ca',
  // TODO(client): replace with real details
  phone: '+1 (000) 000-0000',
  email: 'sales@cellvix.ca',
  supportEmail: 'support@cellvix.ca',
  billingEmail: 'billing@cellvix.ca',
  gstNumber: '00000 0000 RT0001',
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
  // The footer prints the handle beside the icon, so a reader knows which
  // account they are about to land on before they click. Placeholders, like
  // everything else in this object.
  handles: {
    facebook: '@cellvix',
    instagram: '@cellvix',
    linkedin: '@cellvix',
    youtube: '@cellvix',
  },
};

// --- CommonJS exports -------------------------------------------------
exports.BUSINESS_INFO = BUSINESS_INFO;
exports.default = BUSINESS_INFO;
