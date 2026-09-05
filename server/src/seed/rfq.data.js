import { daysAgo, daysAhead, costFor } from './purchase.data.js';

/**
 * Demo data for the supplier process flow (§6.8a).
 *
 * Two halves, because they answer two different questions:
 *
 *   1. **Which component types each supplier is tagged with.** This is what
 *      makes the request-for-quote picker work at all — an untagged supplier
 *      can never be found by it, so a fresh database shows an empty picker and
 *      the feature looks broken rather than unused.
 *   2. **A set of requests across every state the screens render**, so the list
 *      pills, the comparison matrix and the award path all have something to
 *      show without somebody having to build one by hand first.
 *
 * The tags are **not invented**: they follow what each supplier's seeded notes
 * in `purchase.data.js` already claim to sell. Pacific Cell's note says
 * "Batteries and charging ports", so that is what it is tagged with — seed data
 * that contradicts its own copy is worse than none.
 */

/**
 * Component-type tags per supplier, keyed by the code in `SUPPLIERS`.
 *
 * Deliberately uneven. Kaiyuan carries most of the catalogue and Pacific Cell
 * carries two lines, which is what makes the picker worth having: a request for
 * batteries offers three suppliers, one for back glass offers two, and the
 * matched-tags badge on each row explains why.
 */
const SUPPLIER_COMPONENT_TYPES = {
  // "Primary screen supplier" — broad, screen-led.
  SKC: ['screen-assembly', 'back-glass', 'flex-cable', 'front-camera', 'rear-camera'],
  // "Canadian warehouse — two-day delivery, higher unit cost." Stocks the fast
  // movers, which is what a rush order is ever for.
  NPD: ['screen-assembly', 'battery', 'charging-port', 'loud-speaker'],
  // "Batteries and charging ports. Certificates supplied per lot."
  PCS: ['battery', 'charging-port'],
  // "OEM-grade only." Cameras and screens, where the OEM/aftermarket gap is
  // worth paying for.
  AOD: ['screen-assembly', 'rear-camera', 'front-camera'],
  // Deactivated, and tagged anyway — an inactive supplier keeps its tags so
  // reactivating one does not silently return it untagged and unfindable.
  RTC: ['flex-cable'],
};

/**
 * The requests, one per state the screens have to render.
 *
 * `quotes` is expressed as a **multiplier on the line's cost**, not as a
 * hard-coded price: the catalogue is generated with randomised prices, so a
 * literal `unitCost` here would sometimes be above what Cellvix charges and
 * produce a negative margin on the resulting purchase order. A multiplier keeps
 * every quote plausible whatever the generator produced, and keeps the
 * suppliers' relative positions stable — which is the whole point of a
 * comparison screen.
 *
 * `unavailable` names the line index a supplier cannot fill, which is how the
 * "cheaper but incomplete" case gets into the data. That case is the one the
 * comparison exists to get right, and a seed without it would let the screen
 * look correct while the rule went untested by eye.
 */
const RFQ_PLANS = [
  {
    key: 'draft',
    title: 'Q4 screen restock — Samsung S-series',
    componentTypes: ['screen-assembly'],
    lineCount: 4,
    invite: ['SKC', 'AOD'],
    createdAt: daysAgo(1),
    closesAt: daysAhead(9),
    status: 'draft',
    notes: 'Confirm the panel revision before this goes out — last batch was mixed.',
    quotes: {},
  },
  {
    // Out for quote, nobody has answered. The "asked, not opened" state on the
    // detail page, and the row that tells a clerk to chase somebody.
    key: 'awaiting',
    title: 'Back glass — iPhone 14/15',
    componentTypes: ['back-glass'],
    lineCount: 2,
    invite: ['SKC'],
    createdAt: daysAgo(2),
    closesAt: daysAhead(5),
    status: 'sent',
    notes: '',
    quotes: {},
  },
  {
    // Partly answered: one supplier priced it, two have not. The Quotes column
    // reads "1 of 3", which is the figure the list exists to show.
    key: 'partial',
    title: 'Battery restock — mixed models',
    componentTypes: ['battery'],
    lineCount: 3,
    invite: ['PCS', 'NPD', 'SKC'],
    createdAt: daysAgo(4),
    closesAt: daysAhead(3),
    status: 'sent',
    notes: 'Certificates per lot, please — the Alberta account asks for them.',
    quotes: {
      PCS: { multiplier: 0.94, shipping: 2_400, leadTimeDays: 12, note: 'Certificates included per lot.' },
    },
    viewed: ['NPD'],
  },
  {
    /**
     * The comparison, fully answered — and the one that matters.
     *
     * Northbridge is cheapest per unit but **cannot supply line 3**, so its
     * total is smaller for a smaller order and it must NOT rank best. Kaiyuan
     * is the cheapest complete quote and is what `bestInvite` should pick.
     * Atlas is dearest and quickest, which is the tradeoff a lead time exists
     * to show.
     */
    key: 'ready',
    title: 'Charging ports and flex — December',
    componentTypes: ['charging-port', 'flex-cable'],
    lineCount: 4,
    invite: ['NPD', 'SKC', 'AOD'],
    createdAt: daysAgo(6),
    closesAt: daysAhead(2),
    status: 'sent',
    notes: '',
    quotes: {
      NPD: {
        multiplier: 0.88,
        shipping: 4_500,
        leadTimeDays: 2,
        unavailable: [2],
        note: 'Everything but the flex cable — that one is back-ordered with us.',
      },
      SKC: { multiplier: 0.95, shipping: 16_000, leadTimeDays: 21, note: '' },
      AOD: { multiplier: 1.08, shipping: 7_200, leadTimeDays: 6, note: 'OEM grade throughout.' },
    },
  },
  {
    // A supplier who said no. A recorded decline is worth far more than
    // silence, and the screen has to have one to render.
    key: 'declined',
    title: 'Front camera modules — Pixel',
    componentTypes: ['front-camera'],
    lineCount: 2,
    invite: ['AOD', 'SKC'],
    createdAt: daysAgo(8),
    closesAt: daysAhead(1),
    status: 'sent',
    notes: '',
    quotes: {
      SKC: { multiplier: 0.97, shipping: 9_000, leadTimeDays: 18, note: '' },
    },
    declined: { AOD: 'No Pixel tooling this quarter. Try us again in the new year.' },
  },
  {
    // Awarded, with the purchase order it raised. The end state, and the link
    // between the two screens.
    key: 'awarded',
    title: 'Speaker assemblies — bulk',
    componentTypes: ['loud-speaker'],
    lineCount: 3,
    invite: ['NPD', 'SKC'],
    createdAt: daysAgo(16),
    closesAt: daysAgo(9),
    status: 'awarded',
    awardTo: 'NPD',
    notes: '',
    quotes: {
      NPD: { multiplier: 0.9, shipping: 3_800, leadTimeDays: 3, note: '' },
      SKC: { multiplier: 0.93, shipping: 19_500, leadTimeDays: 24, note: 'Cheaper per unit, but the freight is the freight.' },
    },
  },
  {
    key: 'cancelled',
    title: 'Rear cameras — cancelled, model discontinued',
    componentTypes: ['rear-camera'],
    lineCount: 2,
    invite: ['SKC', 'AOD'],
    createdAt: daysAgo(22),
    closesAt: daysAgo(15),
    status: 'cancelled',
    notes: 'Withdrawn — the model was discontinued before we ordered.',
    quotes: {},
  },
];

/**
 * Build the RFQ documents.
 *
 * Every total here is computed the way `rfqService.recomputeInvite` computes
 * it — quantities from the **request**, unavailable lines excluded, shipping
 * added once. Duplicating that arithmetic differently is how seeded data ends
 * up disagreeing with what the running code would produce, which is the bug
 * `quotes.js` warns about in its own header.
 *
 * @param {object[]} products    catalogue rows, with `partType`, `sku`, `price`, `grade`
 * @param {Map} suppliersByCode  code -> supplier document
 * @param {number} startAt       first sequence number for `RFQ-<year>-`
 */
function buildRfqs({ products, suppliersByCode, year, startAt = 1 }) {
  const rows = [];
  let sequence = startAt;

  for (const plan of RFQ_PLANS) {
    // Lines drawn from the component types the request actually covers, so a
    // request "for batteries" contains batteries. A plan whose types match
    // nothing in the catalogue is skipped rather than filled with anything to
    // hand — a request for screens containing a speaker teaches the screen a
    // lie.
    const pool = products.filter((product) => plan.componentTypes.includes(product.partType));
    if (pool.length < 1) continue;

    const items = pool.slice(0, plan.lineCount).map((product, index) => ({
      product: product._id,
      sku: product.sku,
      name: product.name,
      partType: product.partType,
      // Bulk-ish, and varied so the comparison's line totals are not all equal.
      qty: [25, 40, 15, 30][index % 4],
    }));

    const invites = [];
    for (const code of plan.invite) {
      const supplier = suppliersByCode.get(code);
      if (!supplier) continue;

      const quote = plan.quotes[code];
      const declineReason = plan.declined?.[code];

      const invite = {
        supplier: supplier._id,
        supplierName: supplier.name,
        status: 'invited',
        sentAt: plan.status === 'draft' ? undefined : plan.createdAt,
        lines: [],
        subtotal: 0,
        shipping: 0,
        total: 0,
      };

      if (declineReason) {
        invite.status = 'declined';
        invite.viewedAt = plan.createdAt;
        invite.declineReason = declineReason;
      } else if (quote) {
        const unavailable = new Set(quote.unavailable ?? []);

        invite.lines = items.map((item, index) => {
          const product = pool.find((row) => row.sku === item.sku);
          const available = !unavailable.has(index);
          return {
            sku: item.sku,
            // A supplier's price is a markup on OUR cost basis, not on the
            // retail price — that is what a wholesale quote is.
            unitCost: available ? Math.max(1, Math.round(costFor(product) * quote.multiplier)) : 0,
            available,
            note: undefined,
          };
        });

        // Exactly `recomputeInvite`: requested quantities, unavailable lines
        // excluded, shipping added once.
        invite.subtotal = invite.lines
          .filter((line) => line.available)
          .reduce((sum, line) => {
            const item = items.find((candidate) => candidate.sku === line.sku);
            return sum + line.unitCost * (item?.qty ?? 0);
          }, 0);
        invite.shipping = quote.shipping ?? 0;
        invite.total = invite.subtotal + invite.shipping;

        invite.status = 'quoted';
        invite.viewedAt = plan.createdAt;
        invite.quotedAt = new Date(plan.createdAt.getTime() + 36 * 60 * 60 * 1000);
        invite.leadTimeDays = quote.leadTimeDays;
        invite.note = quote.note || undefined;
      } else if (plan.viewed?.includes(code)) {
        // Opened it and has not answered — a different conversation from never
        // having opened it, and the detail page says so.
        invite.status = 'viewed';
        invite.viewedAt = new Date(plan.createdAt.getTime() + 8 * 60 * 60 * 1000);
      }

      invites.push(invite);
    }

    const timeline = [{ status: 'draft', at: plan.createdAt, note: 'Request created.' }];
    if (plan.status !== 'draft') {
      timeline.push({
        status: 'sent',
        at: plan.createdAt,
        note: `Sent to ${invites.length} supplier(s).`,
      });
    }
    for (const invite of invites) {
      if (invite.status === 'quoted') {
        timeline.push({
          status: 'quoted',
          at: invite.quotedAt,
          note: `${invite.supplierName} sent a quote.`,
        });
      }
      if (invite.status === 'declined') {
        timeline.push({
          status: 'declined',
          at: invite.viewedAt,
          note: `${invite.supplierName} declined — ${invite.declineReason}`,
        });
      }
    }
    if (plan.status === 'cancelled') {
      timeline.push({ status: 'cancelled', at: daysAgo(15), note: plan.notes });
    }

    rows.push({
      plan,
      doc: {
        rfqNumber: `RFQ-${year}-${String(sequence++).padStart(5, '0')}`,
        title: plan.title,
        status: plan.status === 'awarded' ? 'sent' : plan.status, // award is applied by the caller
        componentTypes: plan.componentTypes,
        items,
        invites,
        closesAt: plan.closesAt,
        notes: plan.notes || undefined,
        timeline,
        createdAt: plan.createdAt,
        updatedAt: plan.createdAt,
      },
    });
  }

  return rows;
}

export { SUPPLIER_COMPONENT_TYPES, RFQ_PLANS, buildRfqs };
