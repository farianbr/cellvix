import { daysAgo, daysAhead, costFor } from './purchase.data.js';

/**
 * Demo data for supplier bidding on purchase orders (§6.8a).
 *
 * Was `rfq.data.js` until 2026-09-11, when requests for quote folded into the
 * purchase order itself. The plans below survive that move because none of them
 * was ever about the RFQ record - each one exists to put a *state* on screen.
 *
 * Two halves, because they answer two different questions:
 *
 *   1. **Which component types each supplier is tagged with.** This is what
 *      makes the supplier picker work at all - an untagged supplier can never
 *      be found by it, so a fresh database shows an empty picker and the
 *      feature looks broken rather than unused.
 *   2. **A set of orders across every state the screens render**, so the list
 *      pills, the comparison panel and the confirm path all have something to
 *      show without somebody having to build one by hand first.
 *
 * The tags are **not invented**: they follow what each supplier's seeded notes
 * in `purchase.data.js` already claim to sell. Pacific Cell's note says
 * "Batteries and charging ports", so that is what it is tagged with - seed data
 * that contradicts its own copy is worse than none.
 */

/**
 * Component-type tags per supplier, keyed by the code in `SUPPLIERS`.
 *
 * Deliberately uneven. Kaiyuan carries most of the catalogue and Pacific Cell
 * carries two lines, which is what makes the picker worth having: an order for
 * batteries offers three suppliers, one for back glass offers two, and the
 * matched-tags badge on each row explains why.
 */
const SUPPLIER_COMPONENT_TYPES = {
  // "Primary screen supplier" - broad, screen-led.
  SKC: ['screen-assembly', 'back-glass', 'flex-cable', 'front-camera', 'rear-camera'],
  // "Canadian warehouse - two-day delivery, higher unit cost." Stocks the fast
  // movers, which is what a rush order is ever for.
  NPD: ['screen-assembly', 'battery', 'charging-port', 'loud-speaker'],
  // "Batteries and charging ports. Certificates supplied per lot."
  PCS: ['battery', 'charging-port'],
  // "OEM-grade only." Cameras and screens, where the OEM/aftermarket gap is
  // worth paying for.
  AOD: ['screen-assembly', 'rear-camera', 'front-camera'],
  // Deactivated, and tagged anyway - an inactive supplier keeps its tags so
  // reactivating one does not silently return it untagged and unfindable.
  RTC: ['flex-cable'],
};

/**
 * The orders, one per state the screens have to render.
 *
 * `bids` is expressed as a **multiplier on the line's cost**, not as a
 * hard-coded price: the catalogue is generated with randomised prices, so a
 * literal `unitCost` here would sometimes be above what Cellvix charges and
 * produce a negative margin on the resulting order. A multiplier keeps every
 * bid plausible whatever the generator produced, and keeps the suppliers'
 * relative positions stable - which is the whole point of a comparison screen.
 *
 * `unavailable` names the line index a supplier cannot fill, which is how the
 * "cheaper but incomplete" case gets into the data. That case is the one the
 * comparison exists to get right, and a seed without it would let the screen
 * look correct while the rule went untested by eye.
 */
const BID_PLANS = [
  {
    key: 'draft',
    title: 'Q4 screen restock - Samsung S-series',
    componentTypes: ['screen-assembly'],
    lineCount: 4,
    invite: ['SKC', 'AOD'],
    createdAt: daysAgo(1),
    closesAt: daysAhead(9),
    status: 'draft',
    notes: 'Confirm the panel revision before this goes out - last batch was mixed.',
    bids: {},
  },
  {
    // Out for pricing, nobody has answered. The "asked, not opened" state on the
    // detail page, and the row that tells a clerk to chase somebody.
    key: 'awaiting',
    title: 'Back glass - iPhone 14/15',
    componentTypes: ['back-glass'],
    lineCount: 2,
    invite: ['SKC'],
    createdAt: daysAgo(2),
    closesAt: daysAhead(5),
    status: 'sent',
    notes: '',
    bids: {},
  },
  {
    // Partly answered: one supplier priced it, two have not. The Quotes column
    // reads "1 of 3", which is the figure the list exists to show.
    key: 'partial',
    title: 'Battery restock - mixed models',
    componentTypes: ['battery'],
    lineCount: 3,
    invite: ['PCS', 'NPD', 'SKC'],
    createdAt: daysAgo(4),
    closesAt: daysAhead(3),
    status: 'sent',
    notes: 'Certificates per lot, please - the Alberta account asks for them.',
    bids: {
      PCS: {
        multiplier: 0.94,
        shipping: 2_400,
        leadTimeDays: 12,
        note: 'Certificates included per lot.',
        // A PI that matches the order line for line - the case where accepting
        // changes nothing, which the panel has to read as calmly as the others.
        proforma: {
          number: 'PI-PCS-2214',
          paymentTerms: '50% deposit, balance before dispatch',
          bankDetails: 'Pacific Cell Supply Ltd · HSBC HK · 004-812-99120',
        },
      },
    },
    viewed: ['NPD'],
  },
  {
    /**
     * The comparison, fully answered - and the one that matters.
     *
     * Northbridge is cheapest per unit but **cannot supply line 3**, so its
     * total is smaller for a smaller order and it must NOT rank best. Kaiyuan
     * is the cheapest complete bid and is what `bestBid` should pick. Atlas is
     * dearest and quickest, which is the tradeoff a lead time exists to show.
     */
    key: 'ready',
    title: 'Charging ports and flex - December',
    componentTypes: ['charging-port', 'flex-cable'],
    lineCount: 4,
    invite: ['NPD', 'SKC', 'AOD'],
    createdAt: daysAgo(6),
    closesAt: daysAhead(2),
    status: 'sent',
    notes: '',
    bids: {
      NPD: {
        multiplier: 0.88,
        shipping: 4_500,
        leadTimeDays: 2,
        unavailable: [2],
        note: 'Everything but the flex cable - that one is back-ordered with us.',
      },
      SKC: {
        multiplier: 0.95,
        shipping: 16_000,
        leadTimeDays: 21,
        note: '',
        // Invoices SHORT on line 2 and rounds line 3 up to a case pack, so the
        // comparison has a real "this is not what we asked for" to show.
        proforma: {
          number: 'PI-SKC-4488',
          paymentTerms: '30% deposit via Alibaba Trade Assurance',
          bankDetails: 'Shenzhen Kaiyuan Components · BOC · 7742 0091 2280',
          qtyOverrides: { 1: -6, 2: 4 },
        },
      },
      AOD: {
        multiplier: 1.08,
        shipping: 7_200,
        leadTimeDays: 6,
        note: 'OEM grade throughout.',
        proforma: {
          number: 'PI-AOD-0917',
          paymentTerms: 'Net 15 from dispatch',
          bankDetails: 'Atlas OEM Direct · RBC · 00412-003-8871',
        },
      },
    },
  },
  {
    /**
     * Mid-negotiation, with a proforma invoice on the table.
     *
     * New with the bidding rework: the states between "they quoted" and "we
     * confirmed" did not exist while an RFQ was awarded in one step, and they
     * are exactly what the new panel has to render. Kaiyuan has issued a PI and
     * been pushed back on once.
     */
    key: 'negotiating',
    title: 'Screen assemblies - Q1 forward buy',
    componentTypes: ['screen-assembly'],
    lineCount: 3,
    invite: ['SKC', 'NPD'],
    createdAt: daysAgo(10),
    closesAt: daysAhead(4),
    status: 'negotiating',
    notes: 'Volume is firm - push for a better unit price before confirming.',
    bids: {
      SKC: {
        multiplier: 1.02,
        shipping: 14_000,
        leadTimeDays: 19,
        note: '',
        proforma: {
          number: 'PI-SKC-4471',
          paymentTerms: '30% deposit, balance before dispatch.',
          bankDetails: 'Bank of East Asia · SWIFT BEASHKHH · Acct 015-227-88-01102-3',
        },
        // What we asked for, and the round is still open - they have not come
        // back yet, which is the state the panel needs to show.
        negotiation: { askedMultiplier: 0.93, note: 'Can you meet us at this on the panels?' },
      },
      NPD: {
        multiplier: 1.11,
        shipping: 3_900,
        leadTimeDays: 3,
        note: 'Local stock, ships Monday.',
        // Already sent back, so the "revision asked for" state has a screen.
        proforma: {
          number: 'PI-NPD-7731',
          paymentTerms: 'Net 30',
          bankDetails: 'Northbridge Parts Distribution · TD · 004-71129-8827',
          review: 'revision_requested',
          revisionNote: 'Line 1 is priced above the quote - please reissue at the agreed unit cost.',
        },
      },
    },
  },
  {
    // A supplier who said no. A recorded decline is worth far more than
    // silence, and the screen has to have one to render.
    key: 'declined',
    title: 'Front camera modules - Pixel',
    componentTypes: ['front-camera'],
    lineCount: 2,
    invite: ['AOD', 'SKC'],
    createdAt: daysAgo(8),
    closesAt: daysAhead(1),
    status: 'sent',
    notes: '',
    bids: {
      SKC: {
        multiplier: 0.97,
        shipping: 9_000,
        leadTimeDays: 18,
        note: '',
        proforma: {
          number: 'PI-SKC-4501',
          paymentTerms: '30% deposit via Alibaba Trade Assurance',
          bankDetails: 'Shenzhen Kaiyuan Components · BOC · 7742 0091 2280',
        },
      },
    },
    declined: { AOD: 'No Pixel tooling this quarter. Try us again in the new year.' },
  },
  {
    // Confirmed, priced and part-way through delivery. The end state, and what
    // the receiving screen works against.
    key: 'confirmed',
    title: 'Speaker assemblies - bulk',
    componentTypes: ['loud-speaker'],
    lineCount: 3,
    invite: ['NPD', 'SKC'],
    createdAt: daysAgo(16),
    closesAt: daysAgo(9),
    status: 'confirmed',
    confirmWith: 'NPD',
    notes: '',
    bids: {
      NPD: {
        multiplier: 0.9,
        shipping: 3_800,
        leadTimeDays: 3,
        note: '',
        proforma: {
          number: 'PI-NPD-20418',
          paymentTerms: 'Net 30 from dispatch.',
          bankDetails: 'RBC · Transit 05812 · Acct 1002947',
        },
        delivery: { status: 'dispatched', carrier: 'Purolator', trackingNumber: 'PZ4471902884' },
      },
      SKC: {
        multiplier: 0.93,
        shipping: 19_500,
        leadTimeDays: 24,
        note: 'Cheaper per unit, but the freight is the freight.',
      },
    },
  },
  {
    key: 'cancelled',
    title: 'Rear cameras - cancelled, model discontinued',
    componentTypes: ['rear-camera'],
    lineCount: 2,
    invite: ['SKC', 'AOD'],
    createdAt: daysAgo(22),
    closesAt: daysAgo(15),
    status: 'cancelled',
    notes: 'Withdrawn - the model was discontinued before we ordered.',
    bids: {},
  },
];

/**
 * Build the purchase-order documents, with their bids.
 *
 * Every total here is computed the way `purchaseBidService.recomputeBid`
 * computes it - quantities from the **order**, unavailable lines excluded,
 * shipping added once. Duplicating that arithmetic differently is how seeded
 * data ends up disagreeing with what the running code would produce, which is
 * the bug `quotes.js` warns about in its own header.
 *
 * @param {object[]} products    catalogue rows, with `partType`, `sku`, `price`, `grade`
 * @param {Map} suppliersByCode  code -> supplier document
 * @param {number} startAt       first sequence number for `PO-<year>-`
 */
function buildBidOrders({ products, suppliersByCode, year, startAt = 1 }) {
  const rows = [];
  let sequence = startAt;

  for (const plan of BID_PLANS) {
    // Lines drawn from the component types the order actually covers, so an
    // order "for batteries" contains batteries. A plan whose types match
    // nothing in the catalogue is skipped rather than filled with anything to
    // hand - an order for screens containing a speaker teaches the screen a lie.
    const pool = products.filter((product) => plan.componentTypes.includes(product.partType));
    if (pool.length < 1) continue;

    const items = pool.slice(0, plan.lineCount).map((product, index) => ({
      product: product._id,
      sku: product.sku,
      name: product.name,
      // Bulk-ish, and varied so the comparison's line totals are not all equal.
      qtyOrdered: [25, 40, 15, 30][index % 4],
      qtyReceived: 0,
      // Zero until a supplier is confirmed - the order is raised to find out
      // what it costs. `confirmWith` below fills these from the winning bid.
      unitCost: 0,
      lineTotal: 0,
    }));

    const bids = [];
    for (const code of plan.invite) {
      const supplier = suppliersByCode.get(code);
      if (!supplier) continue;

      const quote = plan.bids[code];
      const declineReason = plan.declined?.[code];

      const bid = {
        supplier: supplier._id,
        supplierName: supplier.name,
        status: 'invited',
        sentAt: plan.status === 'draft' ? undefined : plan.createdAt,
        lines: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
      };

      if (declineReason) {
        bid.status = 'declined';
        bid.viewedAt = plan.createdAt;
        bid.declineReason = declineReason;
      } else if (quote) {
        const unavailable = new Set(quote.unavailable ?? []);

        bid.lines = items.map((item, index) => {
          const product = pool.find((row) => row.sku === item.sku);
          const available = !unavailable.has(index);
          return {
            sku: item.sku,
            // A supplier's price is a markup on OUR cost basis, not on the
            // retail price - that is what a wholesale bid is.
            unitCost: available ? Math.max(1, Math.round(costFor(product) * quote.multiplier)) : 0,
            available,
            note: undefined,
          };
        });

        // Exactly `recomputeBid`: ordered quantities, unavailable lines
        // excluded, shipping added once.
        bid.subtotal = bid.lines
          .filter((line) => line.available)
          .reduce((sum, line) => {
            const item = items.find((candidate) => candidate.sku === line.sku);
            return sum + line.unitCost * (item?.qtyOrdered ?? 0);
          }, 0);
        bid.shipping = quote.shipping ?? 0;
        bid.total = bid.subtotal + bid.shipping;

        bid.status = 'quoted';
        bid.viewedAt = plan.createdAt;
        bid.quotedAt = new Date(plan.createdAt.getTime() + 36 * 60 * 60 * 1000);
        bid.leadTimeDays = quote.leadTimeDays;
        bid.note = quote.note || undefined;

        if (quote.proforma) {
          /**
           * The PI's own lines, at the supplier's quantities.
           *
           * **Totalled from these, not copied from the bid.** A proforma is now
           * a document with arithmetic of its own - a supplier may short-ship a
           * line or round one up to a case pack - so seeding it with the bid's
           * totals would produce rows that do not add up to the total beside
           * them, which is exactly the disagreement the diff exists to surface.
           *
           * `qtyOverrides` maps a line index to a delta, so a plan can say
           * "six short on line 2" without restating every quantity.
           */
          const overrides = quote.proforma.qtyOverrides ?? {};
          // Prices come from the bid that was already built above - a proforma
          // is the formal version of a price already given, so a PI quoting a
          // different unit cost than the bid it follows would be a third number
          // nobody asked for.
          const costBySku = new Map(bid.lines.map((line) => [line.sku, line]));

          const piLines = items
            .map((item, index) => {
              const quoted = costBySku.get(item.sku);
              if (!quoted || quoted.available === false) return null;
              const qty = Math.max(0, item.qtyOrdered + (overrides[index] ?? 0));
              return {
                sku: item.sku,
                name: item.name,
                qty,
                unitCost: quoted.unitCost,
              };
            })
            .filter(Boolean);

          const piSubtotal = piLines.reduce((sum, line) => sum + line.unitCost * line.qty, 0);

          bid.proforma = {
            number: quote.proforma.number,
            revision: 1,
            issuedAt: new Date(plan.createdAt.getTime() + 40 * 60 * 60 * 1000),
            lines: piLines,
            subtotal: piSubtotal,
            tax: 0,
            shipping: bid.shipping,
            total: piSubtotal + bid.shipping,
            paymentTerms: quote.proforma.paymentTerms,
            bankDetails: quote.proforma.bankDetails,
            review: quote.proforma.review ?? 'pending',
            revisionNote: quote.proforma.revisionNote,
            revisionRequestedAt:
              quote.proforma.review === 'revision_requested'
                ? new Date(plan.createdAt.getTime() + 48 * 60 * 60 * 1000)
                : undefined,
            history: [],
          };
        }

        if (quote.negotiation) {
          bid.status = 'negotiating';
          bid.negotiations = [
            {
              round: 1,
              askedTotal: Math.round(bid.total * quote.negotiation.askedMultiplier),
              askedLines: [],
              theirCounter: bid.total,
              note: quote.negotiation.note,
              at: new Date(plan.createdAt.getTime() + 60 * 60 * 60 * 1000),
              // Email only: the seed must not claim a channel that has no
              // client behind it (see `supplierMail.sendSupplierMessage`).
              channels: ['email'],
            },
          ];
        }

        if (quote.delivery) {
          bid.delivery = {
            status: quote.delivery.status,
            carrier: quote.delivery.carrier,
            trackingNumber: quote.delivery.trackingNumber,
            dispatchedAt: new Date(plan.createdAt.getTime() + 96 * 60 * 60 * 1000),
          };
        }
      } else if (plan.viewed?.includes(code)) {
        // Opened it and has not answered - a different conversation from never
        // having opened it, and the detail page says so.
        bid.status = 'viewed';
        bid.viewedAt = new Date(plan.createdAt.getTime() + 8 * 60 * 60 * 1000);
      }

      bids.push(bid);
    }

    const timeline = [{ status: 'draft', at: plan.createdAt, note: 'Purchase order created.' }];
    if (plan.status !== 'draft') {
      timeline.push({
        status: 'sent',
        at: plan.createdAt,
        note: `Sent to ${bids.length} supplier(s).`,
      });
    }
    for (const bid of bids) {
      if (['quoted', 'negotiating'].includes(bid.status)) {
        timeline.push({
          status: 'quoted',
          at: bid.quotedAt,
          note: `${bid.supplierName} sent a price.`,
        });
      }
      if (bid.status === 'declined') {
        timeline.push({
          status: 'declined',
          at: bid.viewedAt,
          note: `${bid.supplierName} declined - ${bid.declineReason}`,
        });
      }
    }
    if (plan.status === 'cancelled') {
      timeline.push({ status: 'cancelled', at: daysAgo(15), note: plan.notes });
    }

    rows.push({
      plan,
      doc: {
        poNumber: `PO-${year}-${String(sequence++).padStart(5, '0')}`,
        title: plan.title,
        // `confirmed` is applied by the caller through the real service, so the
        // document is written at the stage before it.
        status: plan.status === 'confirmed' ? 'sent' : plan.status,
        componentTypes: plan.componentTypes,
        items,
        bids,
        orderDate: plan.createdAt,
        closesAt: plan.closesAt,
        notes: plan.notes || undefined,
        timeline,
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        createdAt: plan.createdAt,
        updatedAt: plan.createdAt,
      },
    });
  }

  return rows;
}

export { SUPPLIER_COMPONENT_TYPES, BID_PLANS, buildBidOrders };
