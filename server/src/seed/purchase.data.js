/**
 * Demo purchasing data — suppliers, purchase orders and standalone expenses
 * (ERP rework §6.7–6.9).
 *
 * Built from the seeded catalogue so every PO line points at a product that
 * exists, the same way `content.data.js` builds combos from real SKUs. Nothing
 * here hard-codes a SKU: products are drawn from whatever the catalogue
 * generator produced, so a regenerated catalogue cannot leave a dangling line.
 *
 * The purchase orders deliberately land in every state the list has to render:
 * a draft, one sent and waiting, one overdue against its expected date, one
 * part-received, and two fully received — one of which is paid and therefore
 * carries the expense that payment generated. A demo dataset where everything
 * is `received` teaches nothing about the screen.
 */

const DAY = 86_400_000;

/** `n` whole days before today, at midnight — a purchase date, not a moment. */
function daysAgo(n) {
  const date = new Date(Date.now() - n * DAY);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAhead(n) {
  return daysAgo(-n);
}

const SUPPLIERS = [
  {
    name: 'Shenzhen Kaiyuan Components',
    code: 'SKC',
    email: 'sales@kaiyuan-components.example',
    phone: '+86 755 8100 4420',
    contactName: 'Lena Zhao',
    website: 'https://kaiyuan-components.example',
    address: {
      line1: '18F Huaqiang Plaza',
      city: 'Shenzhen',
      region: 'GD',
      postal: '518031',
      country: 'China',
    },
    paymentTerms: 'net30',
    notes: 'Primary screen supplier. Batch tolerances are good; lead time stretches around Chinese New Year.',
    isActive: true,
  },
  {
    name: 'Northbridge Parts Distribution',
    code: 'NPD',
    email: 'orders@northbridgeparts.example',
    phone: '(416) 555-0142',
    contactName: 'Marc Deschamps',
    website: 'https://northbridgeparts.example',
    address: {
      line1: '2200 Meadowvale Blvd',
      line2: 'Unit 6',
      city: 'Mississauga',
      region: 'ON',
      postal: 'L5N 6H8',
      country: 'Canada',
    },
    paymentTerms: 'net15',
    notes: 'Canadian warehouse — two-day delivery, higher unit cost. Worth it for a rush.',
    isActive: true,
  },
  {
    name: 'Pacific Cell Supply',
    code: 'PCS',
    email: 'hello@pacificcell.example',
    phone: '(604) 555-0188',
    contactName: 'Amrit Sandhu',
    address: {
      line1: '4120 Still Creek Dr',
      city: 'Burnaby',
      region: 'BC',
      postal: 'V5C 6C6',
      country: 'Canada',
    },
    paymentTerms: 'net30',
    notes: 'Batteries and charging ports. Certificates supplied per lot.',
    isActive: true,
  },
  {
    name: 'Atlas OEM Direct',
    code: 'AOD',
    email: 'procurement@atlasoem.example',
    phone: '(514) 555-0176',
    contactName: 'Chantal Roy',
    address: {
      line1: '9400 Rue Meilleur',
      city: 'Montréal',
      region: 'QC',
      postal: 'H2N 2B7',
      country: 'Canada',
    },
    paymentTerms: 'net60',
    notes: 'OEM-grade only. Minimum order applies.',
    isActive: true,
  },
  {
    name: 'Rivet Tools & Consumables',
    code: 'RTC',
    email: 'sales@rivettools.example',
    phone: '(780) 555-0119',
    contactName: 'Dale Okonkwo',
    address: {
      line1: '10320 51 Ave NW',
      city: 'Edmonton',
      region: 'AB',
      postal: 'T6H 0K5',
      country: 'Canada',
    },
    paymentTerms: 'prepaid',
    notes: 'Adhesives and opening tools. Deactivated — replaced by Northbridge.',
    isActive: false,
  },
];

/**
 * Wholesale cost from retail price.
 *
 * Grade-aware: an aftermarket part is bought cheap and marked up hard, an OEM
 * part is bought dear and carries a thinner margin. Rounded to whole cents,
 * because everything in this system is integer cents.
 */
function costFor(product) {
  const ratio = { NEW: 0.62, OEM: 0.7, 'PULL-A': 0.58, 'PULL-B': 0.52, AFTERMARKET: 0.45 };
  return Math.max(1, Math.round(product.price * (ratio[product.grade] ?? 0.6)));
}

/**
 * Six purchase orders across every state the list renders.
 *
 * `receive` is a fraction of each line, applied by the builder: `0` leaves the
 * order untouched, `1` receives it in full, and anything between produces the
 * partial case. The builder derives `status` from what was received rather than
 * taking it from here, exactly as `purchaseService.recomputeStatus` does — so
 * the seeded data cannot contradict the rule the running code enforces.
 */
const PO_PLANS = [
  {
    supplierCode: 'SKC',
    lines: 4,
    orderDate: daysAgo(2),
    expectedDate: daysAhead(26),
    draft: true,
    receive: 0,
    paid: false,
    shipping: 18_000,
    notes: 'Quarterly screen restock. Confirm the panel revision before sending.',
  },
  {
    supplierCode: 'NPD',
    lines: 3,
    orderDate: daysAgo(6),
    expectedDate: daysAhead(4),
    draft: false,
    receive: 0,
    paid: false,
    shipping: 4_500,
    notes: 'Rush order to cover the shortfall on the Toronto account.',
  },
  {
    // Expected date in the past with nothing received — this is the row the
    // list has to flag as overdue, and it is derived, never stored.
    supplierCode: 'PCS',
    lines: 3,
    orderDate: daysAgo(34),
    expectedDate: daysAgo(9),
    draft: false,
    receive: 0,
    paid: false,
    shipping: 3_200,
    notes: 'Chased 3 days ago — carrier claims customs hold.',
  },
  {
    supplierCode: 'SKC',
    lines: 5,
    orderDate: daysAgo(21),
    expectedDate: daysAgo(3),
    draft: false,
    receive: 0.5,
    paid: false,
    shipping: 21_500,
    notes: 'Split shipment — second container still in transit.',
  },
  {
    supplierCode: 'AOD',
    lines: 3,
    orderDate: daysAgo(48),
    expectedDate: daysAgo(33),
    draft: false,
    receive: 1,
    paid: true,
    method: 'Wire transfer',
    shipping: 9_800,
    notes: '',
  },
  {
    supplierCode: 'NPD',
    lines: 4,
    orderDate: daysAgo(70),
    expectedDate: daysAgo(62),
    draft: false,
    receive: 1,
    paid: false,
    shipping: 5_400,
    notes: 'Received in full. Invoice not yet entered.',
  },
];

/**
 * Build the purchase orders.
 *
 * `products` is the seeded catalogue and `suppliersByCode` maps a supplier code
 * to its inserted document. Returns plain objects ready for `insertMany`, plus
 * the stock movements each receipt implies — the seed writes both, because a
 * received quantity with no movement behind it is exactly the unexplainable
 * stock the ledger exists to prevent.
 */
function buildPurchaseOrders({ products, suppliersByCode, year = new Date().getFullYear() }) {
  const orders = [];
  const movements = [];
  const stockDelta = new Map();

  let sequence = 1;
  let cursor = 0;

  for (const plan of PO_PLANS) {
    const supplier = suppliersByCode.get(plan.supplierCode);
    if (!supplier) continue;

    // Walk the catalogue rather than sampling randomly, so a reseed produces
    // the same demo data and a screenshot run stays comparable.
    const picked = [];
    for (let i = 0; i < plan.lines; i += 1) {
      picked.push(products[(cursor + i) % products.length]);
    }
    cursor += plan.lines;

    const items = picked.map((product, index) => {
      const unitCost = costFor(product);
      const qtyOrdered = 10 + index * 5;
      return {
        product: product._id,
        sku: product.sku,
        name: product.name,
        qtyOrdered,
        qtyReceived: 0,
        unitCost,
        lineTotal: qtyOrdered * unitCost,
      };
    });

    const poNumber = `PO-${year}-${String(sequence).padStart(5, '0')}`;
    sequence += 1;

    const timeline = [{ status: 'draft', at: plan.orderDate, note: 'Purchase order created.' }];
    let status = 'draft';
    let receivedDate = null;

    if (!plan.draft) {
      status = 'sent';
      timeline.push({ status: 'sent', at: plan.orderDate, note: 'Sent to supplier.' });
    }

    if (plan.receive > 0) {
      const receivedAt = plan.expectedDate ?? plan.orderDate;

      for (const item of items) {
        const qty = Math.max(1, Math.round(item.qtyOrdered * plan.receive));
        item.qtyReceived = Math.min(qty, item.qtyOrdered);

        const previous = stockDelta.get(String(item.product)) ?? 0;
        const after = previous + item.qtyReceived;
        stockDelta.set(String(item.product), after);

        movements.push({
          product: item.product,
          type: 'purchase',
          qtyChange: item.qtyReceived,
          // Filled in by the caller once the product's true starting quantity
          // is known — a seeded `qtyAfter` computed here would be a guess.
          qtyAfter: after,
          unitCost: item.unitCost,
          reference: { kind: 'purchase_order', label: poNumber },
          poNumber,
          createdAt: receivedAt,
        });
      }

      const received = items.reduce((sum, item) => sum + item.qtyReceived, 0);
      const ordered = items.reduce((sum, item) => sum + item.qtyOrdered, 0);
      status = received >= ordered ? 'received' : 'partial';
      if (status === 'received') receivedDate = receivedAt;

      timeline.push({ status, at: receivedAt, note: `Received ${received} unit(s).` });
    }

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    // 13% HST — Cellvix is Ontario-based. Phase 11 moves the rate to Settings;
    // it is applied here rather than left at zero so the tax column is not
    // uniformly empty on every seeded screen.
    const tax = Math.round(subtotal * 0.13);
    const shipping = plan.shipping ?? 0;

    orders.push({
      poNumber,
      supplier: supplier._id,
      status,
      orderDate: plan.orderDate,
      expectedDate: plan.expectedDate,
      receivedDate,
      items,
      subtotal,
      tax,
      shipping,
      total: subtotal + tax + shipping,
      payment: { status: 'unpaid' },
      timeline,
      notes: plan.notes || undefined,
      // Read back by the caller to create the expense that a paid PO generates.
      _paid: Boolean(plan.paid),
      _method: plan.method,
    });
  }

  return { orders, movements };
}

/**
 * Standalone expenses — the ones an operator enters by hand, as opposed to the
 * rows a PO payment generates. Categories are looked up by slug so this list
 * survives the category ids changing.
 */
const EXPENSE_PLANS = [
  { daysAgo: 4, description: 'Warehouse rent — current month', slug: 'rent', payee: 'Meadowvale Holdings', method: 'Pre-authorised debit', amount: 385_000, tax: 0, status: 'paid' },
  { daysAgo: 6, description: 'Hydro and water', slug: 'utilities', payee: 'Alectra Utilities', method: 'Pre-authorised debit', amount: 41_280, tax: 4_747, status: 'paid' },
  { daysAgo: 9, description: 'Courier account top-up', slug: 'shipping', payee: 'Purolator', method: 'Credit card', amount: 120_000, tax: 13_805, status: 'paid' },
  { daysAgo: 12, description: 'Accounting software — annual', slug: 'software', payee: 'Ledgerly Inc.', method: 'Credit card', amount: 89_900, tax: 10_339, status: 'paid' },
  { daysAgo: 15, description: 'Commercial general liability premium', slug: 'insurance', payee: 'Northgate Insurance', method: 'Cheque', amount: 214_500, tax: 0, status: 'paid' },
  { daysAgo: 18, description: 'Bookkeeping — quarterly review', slug: 'professional-fees', payee: 'Roy & Associates', method: 'e-Transfer', amount: 95_000, tax: 10_929, status: 'pending' },
  { daysAgo: 21, description: 'Business account monthly fees', slug: 'bank-charges', payee: 'RBC', method: 'Direct debit', amount: 6_500, tax: 0, status: 'paid' },
  { daysAgo: 24, description: 'Supplier directory listing', slug: 'marketing', payee: 'RepairBiz Directory', method: 'Credit card', amount: 45_000, tax: 5_177, status: 'paid' },
  { daysAgo: 27, description: 'Anti-static bags and labels', slug: 'supplies', payee: 'Rivet Tools & Consumables', method: 'Credit card', amount: 28_400, tax: 3_268, status: 'paid' },
  { daysAgo: 33, description: 'Staff wages — bi-weekly', slug: 'salaries', payee: 'Payroll', method: 'Direct deposit', amount: 1_240_000, tax: 0, status: 'paid' },
  { daysAgo: 41, description: 'Warehouse rent — previous month', slug: 'rent', payee: 'Meadowvale Holdings', method: 'Pre-authorised debit', amount: 385_000, tax: 0, status: 'paid' },
  { daysAgo: 55, description: 'Shelving and bins', slug: 'supplies', payee: 'Rivet Tools & Consumables', method: 'Credit card', amount: 76_200, tax: 8_769, status: 'paid' },
];

/**
 * `categoriesBySlug` maps a slug to its inserted category document.
 * `startSequence` continues the `EXP-` numbering after the rows the paid
 * purchase orders already generated, so no two expenses share a number.
 */
function buildExpenses({ categoriesBySlug, year = new Date().getFullYear(), startSequence = 1 }) {
  let sequence = startSequence;

  return EXPENSE_PLANS.flatMap((plan) => {
    const category = categoriesBySlug.get(plan.slug);
    if (!category) return [];

    const number = `EXP-${year}-${String(sequence).padStart(5, '0')}`;
    sequence += 1;

    return [
      {
        number,
        date: daysAgo(plan.daysAgo),
        description: plan.description,
        category: category._id,
        payee: plan.payee,
        method: plan.method,
        status: plan.status,
        amount: plan.amount,
        tax: plan.tax,
        taxIncluded: true,
        reference: undefined,
      },
    ];
  });
}

/**
 * Supplier returns — stock going back up the chain (§6.8b).
 *
 * The mirror of an RMA: a customer returns to us, we return to a supplier. The
 * screen had no seeded rows at all, so it was only ever seen in its empty
 * state and none of its statuses, credit handling or SLA ageing had anything
 * to render.
 *
 * Every return is built **from a real purchase order line**, exactly as
 * `supplierReturnService` requires — you cannot send back a part you never
 * bought, and a seeded return naming a part that was never ordered would be
 * teaching the opposite.
 *
 * `expectedCredit` is what we claimed; `creditAmount` is what the supplier
 * actually issued, and the two differ on purpose — a supplier who part-credits
 * a claim is the case worth being able to see.
 */
const SUPPLIER_RETURN_PLANS = [
  {
    status: 'draft',
    reason: 'faulty',
    itemReason: 'faulty',
    lines: 1,
    qty: 3,
    daysAgo: 1,
    note: 'Three panels dead on arrival out of the last carton.',
  },
  {
    status: 'requested',
    reason: 'wrong_item',
    itemReason: 'wrong_item',
    lines: 1,
    qty: 5,
    daysAgo: 4,
    note: 'Pro Max panels shipped against a Pro line. RMA number requested.',
  },
  {
    status: 'authorised',
    reason: 'faulty',
    itemReason: 'faulty',
    lines: 2,
    qty: 4,
    daysAgo: 9,
    supplierRma: 'NB-RMA-88214',
    note: 'Touch layer delaminating within a fortnight of fitting.',
  },
  {
    status: 'shipped',
    reason: 'over_shipped',
    itemReason: 'over_shipped',
    lines: 1,
    qty: 8,
    daysAgo: 16,
    supplierRma: 'KY-2026-0451',
    carrier: 'Purolator',
    tracking: 'CVX441907722',
    note: 'Eight over the ordered quantity — returned at their cost.',
  },
  {
    status: 'credited',
    reason: 'damaged_in_transit',
    itemReason: 'damaged_in_transit',
    lines: 2,
    qty: 6,
    daysAgo: 31,
    closedDaysAgo: 22,
    supplierRma: 'PC-RMA-3390',
    carrier: 'Canada Post',
    tracking: 'CVX441822015',
    // Credited in full.
    creditRatio: 1,
    note: 'Carton crushed in transit; photographed on arrival.',
  },
  {
    status: 'credited',
    reason: 'faulty',
    itemReason: 'faulty',
    lines: 1,
    qty: 4,
    daysAgo: 44,
    closedDaysAgo: 35,
    supplierRma: 'NB-RMA-87001',
    // Part-credited: the supplier accepted three of the four.
    creditRatio: 0.75,
    note: 'Supplier accepted three of the four as genuine failures.',
  },
  {
    status: 'rejected',
    reason: 'not_as_described',
    itemReason: 'not_as_described',
    lines: 1,
    qty: 2,
    daysAgo: 58,
    closedDaysAgo: 49,
    supplierRma: 'AT-RMA-1120',
    note: 'Supplier held the grading was as listed. Claim refused.',
  },
];

/**
 * `purchaseOrders` are the inserted POs, so their lines carry real product ids
 * and the costs the parts were actually bought at.
 */
function buildSupplierReturns({ purchaseOrders = [], year = new Date().getFullYear() }) {
  // Only a PO that actually went out can have stock coming back off it.
  const usable = purchaseOrders.filter(
    (po) => po.status !== 'draft' && (po.items ?? []).length > 0,
  );
  if (!usable.length) return [];

  let sequence = 1;

  return SUPPLIER_RETURN_PLANS.map((plan, index) => {
    const po = usable[index % usable.length];
    const sourceLines = (po.items ?? []).slice(0, plan.lines);
    if (!sourceLines.length) return null;

    const createdAt = daysAgo(plan.daysAgo);
    const closedAt = plan.closedDaysAgo != null ? daysAgo(plan.closedDaysAgo) : null;

    const items = sourceLines.map((line) => ({
      product: line.product,
      sku: line.sku,
      name: line.name,
      // Never more than were bought — the cap the service enforces.
      qty: Math.min(plan.qty, line.qtyOrdered ?? plan.qty),
      unitCost: line.unitCost,
      reason: plan.itemReason,
    }));

    const expectedCredit = items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
    const credited = plan.status === 'credited';

    // The rungs this return actually climbed. `rejected` is an exit rather than
    // a rung, so it follows the stages that did happen instead of replacing
    // them — the same treatment the ticket and quote life cycles get.
    const ladder =
      plan.status === 'rejected'
        ? ['draft', 'requested', 'rejected']
        : ['draft', 'requested', 'authorised', 'shipped', 'credited'].slice(
            0,
            ['draft', 'requested', 'authorised', 'shipped', 'credited'].indexOf(plan.status) + 1,
          );

    const span = Math.max(1, plan.daysAgo - (plan.closedDaysAgo ?? 0));

    return {
      returnNumber: `SRT-${year}-${String(sequence++).padStart(5, '0')}`,

      supplier: po.supplier,
      supplierName: po.supplierName,
      purchaseOrder: po._id,
      purchaseOrderNumber: po.poNumber,

      status: plan.status,
      reason: plan.note,
      items,

      supplierRmaNumber: plan.supplierRma,
      expectedCredit,
      // Only a credited return has money back; everything else is a claim.
      creditAmount: credited ? Math.round(expectedCredit * (plan.creditRatio ?? 1)) : 0,
      creditReference: credited ? `CN-${plan.supplierRma ?? sequence}` : undefined,
      creditedAt: credited ? closedAt : undefined,

      carrier: plan.carrier,
      trackingNumber: plan.tracking,

      shippedAt: ['shipped', 'credited'].includes(plan.status)
        ? closedAt ?? daysAgo(Math.max(0, plan.daysAgo - 3))
        : undefined,

      timeline: ladder.map((status, i) => ({
        status,
        at: daysAgo(plan.daysAgo - Math.round((span * i) / Math.max(1, ladder.length - 1))),
        note: i === 0 ? plan.note : null,
      })),

      createdAt,
      updatedAt: closedAt ?? createdAt,
    };
  }).filter(Boolean);
}

/**
 * Supplier services and subscriptions (§6.8c).
 *
 * **Neither is the customer catalogue.** These are costs the business buys in —
 * a licence, a courier account, an outsourced repair — and they land in the
 * P&L as real expense rows. Nothing here has stock or reaches the storefront.
 *
 * One screen renders both, split by billing cycle: a recurring `billing`
 * makes it a subscription with a renewal date, `one_off` makes it a service
 * product bought as needed. Both shapes are seeded, and the renewal dates are
 * spread either side of today on purpose — the board's "due soon" and
 * "overdue" counts are derived from that date, and a set that all renew next
 * year leaves both reading zero.
 */
const SUPPLIER_SERVICE_PLANS = [
  {
    name: 'Repair shop management licence',
    code: 'SW-RSM-PRO',
    categorySlug: 'software',
    billing: 'monthly',
    amount: 18_900,
    startedDaysAgo: 400,
    renewsInDays: 6,
    supplierCode: 'NPD',
    description: 'Per-seat licence for the workshop management suite. Five seats.',
  },
  {
    name: 'Courier account — Purolator',
    code: 'LOG-PURO',
    categorySlug: 'shipping',
    billing: 'monthly',
    amount: 42_500,
    startedDaysAgo: 300,
    renewsInDays: 11,
    description: 'Business account, billed on volume with a monthly minimum.',
  },
  {
    name: 'Liability and stock insurance',
    code: 'INS-GL-2026',
    categorySlug: 'insurance',
    billing: 'yearly',
    amount: 1_450_000,
    startedDaysAgo: 200,
    renewsInDays: 165,
    description: 'General liability plus stock cover at both locations.',
  },
  {
    name: 'Accounting and payroll',
    code: 'PRO-ACCT',
    categorySlug: 'professional-fees',
    billing: 'quarterly',
    amount: 135_000,
    startedDaysAgo: 270,
    renewsInDays: 34,
    description: 'Quarterly filing, payroll runs and year-end preparation.',
  },
  {
    name: 'Parts diagnostic subscription',
    code: 'SW-DIAG',
    categorySlug: 'software',
    billing: 'monthly',
    amount: 7_900,
    startedDaysAgo: 150,
    // Already past its date — the overdue count needs a row.
    renewsInDays: -4,
    supplierCode: 'SKC',
    description: 'Board-level schematics and boardview library.',
  },
  {
    name: 'Waste electronics disposal',
    code: 'SVC-WEEE',
    categorySlug: 'supplies',
    billing: 'quarterly',
    amount: 24_000,
    startedDaysAgo: 500,
    renewsInDays: 52,
    description: 'Certified disposal and the paperwork that proves it.',
  },

  // ---- one-offs: services bought as needed, never renewing -----------------
  {
    name: 'Outsourced micro-soldering',
    code: 'SVC-MICRO',
    categorySlug: 'professional-fees',
    billing: 'one_off',
    amount: 12_000,
    startedDaysAgo: 21,
    supplierCode: 'AOD',
    description: 'Board work sent out when it is beyond the bench.',
  },
  {
    name: 'Data recovery — sent out',
    code: 'SVC-DATA',
    categorySlug: 'professional-fees',
    billing: 'one_off',
    amount: 35_000,
    startedDaysAgo: 9,
    description: 'Chip-off recovery for water-damaged handsets.',
  },
  {
    name: 'Shopfront window signage',
    code: 'SVC-SIGN',
    categorySlug: 'marketing',
    billing: 'one_off',
    amount: 89_000,
    startedDaysAgo: 64,
    description: 'Vinyl refit at the Toronto storefront.',
  },
  // Cancelled, so the screen's inactive filter has something to find.
  {
    name: 'Legacy till software',
    code: 'SW-TILL-OLD',
    categorySlug: 'software',
    billing: 'monthly',
    amount: 5_900,
    startedDaysAgo: 700,
    renewsInDays: 14,
    cancelledDaysAgo: 40,
    description: 'Replaced by the management suite. Kept for the audit trail.',
  },
];

/**
 * @param categoriesBySlug  the inserted expense categories, keyed by slug —
 *                          `category` is required and is a real reference
 * @param suppliersByCode   inserted suppliers, so a service bought from a known
 *                          supplier names it rather than repeating a string
 */
function buildSupplierServices({ categoriesBySlug = new Map(), suppliersByCode = new Map() }) {
  // `supplier` is required — a cost is owed to somebody, and a service with no
  // payee is not a record anybody can act on. Plans that do not name one are
  // given a supplier by rotation rather than being dropped.
  const allSuppliers = [...suppliersByCode.values()];

  return SUPPLIER_SERVICE_PLANS.map((plan, index) => {
    const category = categoriesBySlug.get(plan.categorySlug);
    // A service with no category cannot be saved — the field is required and
    // it is what the P&L groups by. Skipped rather than forced onto whatever
    // category happens to be first.
    if (!category) return null;

    const supplier =
      (plan.supplierCode ? suppliersByCode.get(plan.supplierCode) : null) ??
      allSuppliers[index % Math.max(1, allSuppliers.length)];
    if (!supplier) return null;

    const cancelled = plan.cancelledDaysAgo != null;

    return {
      name: plan.name,
      code: plan.code,
      description: plan.description,

      supplier: supplier._id,
      supplierName: supplier.name,

      amount: plan.amount,
      billing: plan.billing,
      category: category._id,

      startedAt: daysAgo(plan.startedDaysAgo),
      // A one-off never renews, so it carries no renewal date at all — a date
      // on it would put it on the renewals board, which is for commitments.
      nextRenewalAt:
        plan.billing === 'one_off' || plan.renewsInDays == null
          ? undefined
          : daysAhead(plan.renewsInDays),

      cancelledAt: cancelled ? daysAgo(plan.cancelledDaysAgo) : undefined,
      isActive: !cancelled,

      createdAt: daysAgo(plan.startedDaysAgo),
    };
  }).filter(Boolean);
}

export {
  daysAgo,
  daysAhead,
  SUPPLIERS,
  costFor,
  buildPurchaseOrders,
  buildExpenses,
  buildSupplierReturns,
  buildSupplierServices,
};
