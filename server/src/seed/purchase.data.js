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

export { daysAgo, daysAhead, SUPPLIERS, costFor, buildPurchaseOrders, buildExpenses };
