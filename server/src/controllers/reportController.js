const { asyncHandler } = require('../utils/ApiError.js');
const reportService = require('../services/reportService.js');

/**
 * Reports (ERP rework §6.11–6.12).
 *
 * One endpoint, one tab per path segment. Every handler is read-only — §9.6 is
 * not a convention here, it is the reason this controller has no POST, PATCH or
 * DELETE at all.
 */
const report = asyncHandler(async (req, res) => {
  res.json(await reportService.report(req.params.tab, req.query));
});

// --- CommonJS exports -------------------------------------------------
exports.report = report;
