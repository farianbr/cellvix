import mongoose from 'mongoose';

/**
 * The settings singleton (ERP rework §8, §6.15).
 *
 * **The screens that edit these are phase 11; the data model is not.** Tax
 * rates, invoice due days, warranty lengths and shipping bands are read by
 * earlier phases, and §10's sequencing note is explicit about why they land
 * here first: hard-coding a rate in phase 5 or 6 and "moving it to Settings
 * later" is how a system ends up with two sources of truth for the tax rate.
 *
 * Phase 6 reads `financial.taxRatesByProvince`. Phase 11 builds the form.
 *
 * One document, found by `Settings.load()`, which creates it from the seeded
 * defaults on first read so no caller has to handle its absence.
 */

/**
 * Standard 2026 provincial rates (§0.13 — to be confirmed with the client,
 * editable in Settings from day one).
 *
 * `kind` matters for the tax report: HST is a single combined tax, GST+PST are
 * two taxes that happen to be collected together, and the register has to be
 * able to say which it is rather than printing one blended number.
 */
export const DEFAULT_TAX_RATES = [
  { province: 'AB', rate: 0.05, kind: 'GST' },
  { province: 'BC', rate: 0.12, kind: 'GST+PST' },
  { province: 'MB', rate: 0.12, kind: 'GST+PST' },
  { province: 'NB', rate: 0.15, kind: 'HST' },
  { province: 'NL', rate: 0.15, kind: 'HST' },
  { province: 'NS', rate: 0.14, kind: 'HST' },
  { province: 'NT', rate: 0.05, kind: 'GST' },
  { province: 'NU', rate: 0.05, kind: 'GST' },
  { province: 'ON', rate: 0.13, kind: 'HST' },
  { province: 'PE', rate: 0.15, kind: 'HST' },
  { province: 'QC', rate: 0.14975, kind: 'GST+QST' },
  { province: 'SK', rate: 0.11, kind: 'GST+PST' },
  { province: 'YT', rate: 0.05, kind: 'GST' },
];

const settingsSchema = new mongoose.Schema(
  {
    // The singleton key. Unique, so a second document cannot be created by a
    // race — `load()` upserts against it.
    key: { type: String, default: 'singleton', unique: true, index: true },

    business: {
      name: { type: String, default: 'Cellvix' },
      tagline: { type: String, default: 'Wholesale phone and laptop parts' },
      phone: { type: String, default: '(416) 555-0100' },
      email: { type: String, default: 'sales@cellvix.ca' },
      website: { type: String, default: 'https://cellvix.ca' },
      // Dummy until the client supplies the real number (§0.15).
      taxNumber: { type: String, default: '12345 6789 RT0001' },
      address: {
        line1: { type: String, default: '2200 Meadowvale Blvd' },
        line2: { type: String, default: 'Unit 12' },
        city: { type: String, default: 'Mississauga' },
        region: { type: String, default: 'ON' },
        postal: { type: String, default: 'L5N 6H8' },
        country: { type: String, default: 'CA' },
      },
    },

    financial: {
      timezone: { type: String, default: 'America/Toronto' },
      currency: { type: String, default: 'CAD' },

      taxRatesByProvince: {
        type: [
          {
            _id: false,
            province: String,
            rate: Number, // a fraction, not a percentage: 0.13, never 13
            kind: String,
          },
        ],
        default: () => DEFAULT_TAX_RATES,
      },

      defaultDueDays: { type: Number, default: 30 },

      // Dummy values until the client confirms (§0.12).
      warrantyByGrade: {
        type: Map,
        of: Number, // days
        default: () => new Map([['NEW', 365], ['OEM', 180], ['PULL-A', 90], ['PULL-B', 60], ['AFTERMARKET', 90]]),
      },
    },

    operations: {
      rmaSlaDays: { type: Number, default: 14 },
      lowStockThreshold: { type: Number, default: 50 },
    },
  },
  { timestamps: true },
);

/**
 * The one way to read settings.
 *
 * Upserts on first call so every caller gets a fully-defaulted document rather
 * than having to branch on "not configured yet". Returns a lean object — this
 * is read on report paths and nothing mutates it through here.
 */
settingsSchema.statics.load = async function load() {
  const existing = await this.findOne({ key: 'singleton' }).lean();
  if (existing) return existing;

  await this.updateOne({ key: 'singleton' }, { $setOnInsert: { key: 'singleton' } }, { upsert: true });
  return this.findOne({ key: 'singleton' }).lean();
};

/**
 * The rate for one province, as a fraction. Falls back to Ontario's HST, which
 * is where Cellvix is registered — an unknown province is a data problem, not a
 * reason to charge zero tax.
 */
settingsSchema.statics.rateFor = function rateFor(settings, province) {
  const rates = settings?.financial?.taxRatesByProvince ?? DEFAULT_TAX_RATES;
  const match = rates.find((row) => row.province === province);
  return match?.rate ?? rates.find((row) => row.province === 'ON')?.rate ?? 0.13;
};

export const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
