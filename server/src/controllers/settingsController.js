const { asyncHandler } = require('../utils/ApiError.js');
const settingsService = require('../services/settingsService.js');
const auditService = require('../services/auditService.js');

/**
 * Settings (ERP rework §6.15, phase 11).
 *
 * One read and one write per section. There is no whole-document PUT, and that
 * is deliberate: a form posts back the copy it loaded on open, so a wholesale
 * write would let Sale Settings silently revert a shipping band somebody edited
 * in another tab. Each route touches only the paths its own screen owns.
 */

const get = asyncHandler(async (req, res) => {
  res.json(await settingsService.get());
});

/**
 * Every settings write is audited (§7.5, phase 11b).
 *
 * These change what the whole system charges and promises — a tax rate, a
 * shipping price, a warranty length — so a change with no actor on it is a
 * number nobody can account for. One helper because all six writes are the
 * same shape: snapshot, write, log the diff between them.
 *
 * `recordChange` skips the row when nothing actually moved, so opening a form
 * and pressing save does not fill the log with entries that say nothing.
 */
function auditedWrite(section, write, describe) {
  return asyncHandler(async (req, res) => {
    const before = await settingsService.get();
    const after = await write(req.body);

    await auditService.recordChange({
      req,
      action: `settings.${section}`,
      entity: { kind: 'settings', id: section, label: describe },
      // Scoped to the section this route owns, so a shipping edit does not
      // produce a row listing every unrelated field on the document.
      before: sectionOf(before, section),
      after: sectionOf(after, section),
      description: `Updated ${describe}.`,
    });

    res.json(after);
  });
}

/**
 * The slice of the settings document a given screen owns.
 *
 * Flattened to one level: a diff over whole nested objects would report
 * `financial` as changed and leave the reader to work out which of its dozen
 * fields moved.
 */
function sectionOf(settings, section) {
  switch (section) {
    case 'business':
      return { ...settings.business, address: settings.business?.address };
    case 'sale':
      return {
        timezone: settings.financial?.timezone,
        defaultDueDays: settings.financial?.defaultDueDays,
        taxRatesByProvince: settings.financial?.taxRatesByProvince,
        warrantyByGrade: settings.financial?.warrantyByGrade,
        rmaSlaDays: settings.operations?.rmaSlaDays,
      };
    case 'shipping':
      return { shippingMethods: settings.financial?.shippingMethods };
    case 'payment-methods':
      return { paymentMethods: settings.financial?.paymentMethods };
    case 'inventory':
      return settings.inventory;
    case 'communications':
      return settings.communications;
    default:
      return {};
  }
}

const updateBusiness = auditedWrite(
  'business',
  (body) => settingsService.updateBusiness(body),
  'business information',
);

const updateSale = auditedWrite(
  'sale',
  (body) => settingsService.updateSale(body),
  'sale settings',
);

const updateShipping = auditedWrite(
  'shipping',
  (body) => settingsService.updateShipping(body),
  'shipping rates',
);

const updatePaymentMethods = auditedWrite(
  'payment-methods',
  (body) => settingsService.updatePaymentMethods(body),
  'payment methods',
);

const updateCommunications = auditedWrite(
  'communications',
  (body) => settingsService.updateCommunications(body),
  'email settings',
);

const updateInventory = auditedWrite(
  'inventory',
  (body) => settingsService.updateInventory(body),
  'inventory defaults',
);

// --- CommonJS exports -------------------------------------------------
exports.get = get;
exports.updateBusiness = updateBusiness;
exports.updateSale = updateSale;
exports.updateShipping = updateShipping;
exports.updatePaymentMethods = updatePaymentMethods;
exports.updateCommunications = updateCommunications;
exports.updateInventory = updateInventory;
