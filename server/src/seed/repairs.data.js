/**
 * Demo repairs, as complete chains rather than as loose records.
 *
 * A repair is up to three records — **quote → ticket → invoice** — and the
 * three screens that render it all read the links between them. Seeding each
 * one separately produced a database where every ticket was an orphan: the
 * workflow lineage strip had nothing to draw, and the only chains that existed
 * were the ones somebody had clicked through by hand.
 *
 * This builds the chains whole, in the three shapes the system actually
 * produces:
 *
 *   quoted → repaired → invoiced   the full chain, all three stations
 *   quoted → still in repair       a chain whose invoice is genuinely pending
 *   walk-in → invoiced             no quote at all, and the lineage strip must
 *                                  omit that station rather than grey it
 *
 * The third is the one worth being deliberate about. A ticket taken at the
 * counter was never quoted, and a demo database without one lets the "omit the
 * station" rule go untested by eye.
 *
 * ## Everything is priced the way the running code prices it
 *
 * Line totals, tax and the invoice balance are computed here with the same
 * arithmetic `ticketService.priceTicket` applies — integer cents throughout,
 * tax from a rate rather than a stored amount, and the invoice's `amountPaid`
 * derived from its payment rows rather than asserted. A seeded record that
 * disagrees with what the service would produce is worse than no record,
 * because it teaches the wrong thing about the screen.
 */

const DAY = 86_400_000;

function daysAgo(n) {
  return new Date(Date.now() - n * DAY);
}

/**
 * The work a shop actually sells, priced in cents.
 *
 * Named rather than drawn from the product catalogue: a screen replacement is
 * labour plus a part, and the labour half has no SKU. The parts that DO come
 * from stock are matched to a catalogue product by the builder below, so a
 * regenerated catalogue cannot leave a dangling reference.
 */
const SERVICES = {
  screen: { name: 'Screen replacement', priceCents: 24_900 },
  battery: { name: 'Battery replacement', priceCents: 12_900 },
  charging: { name: 'Charging port repair', priceCents: 9_900 },
  water: { name: 'Liquid damage treatment', priceCents: 14_900 },
  camera: { name: 'Rear camera replacement', priceCents: 18_900 },
  speaker: { name: 'Loudspeaker replacement', priceCents: 7_900 },
  diagnostic: { name: 'Bench diagnostic', priceCents: 4_900 },
  board: { name: 'Board-level micro-soldering', priceCents: 34_900 },
};

/**
 * One demo repair.
 *
 * `chain` says which of the three shapes this is. `status` is only read for a
 * ticket that has not been invoiced — an invoiced ticket is `completed` by
 * definition, and letting a plan claim otherwise would produce a ticket whose
 * stage disagrees with the invoice sitting against it.
 */
const REPAIR_PLANS = [
  // ---- full chains: quoted, repaired, invoiced -----------------------------
  {
    chain: 'quoted-invoiced',
    customer: { name: 'Aisha Khan', phone: '+1 7804514944', email: 'aisha.khan@example.ca' },
    device: { category: 'Phone', brand: 'Apple', series: 'iPhone 13', model: 'iPhone 13 Pro Max', serial: 'F2LX9K3JQ1MP' },
    problem: 'Battery drains within a few hours and the handset runs hot on charge.',
    solution: 'Battery replaced with an OEM cell; drain and thermals verified over a 4-hour soak.',
    services: ['battery'],
    quotedDaysAgo: 26,
    openedDaysAgo: 24,
    closedDaysAgo: 20,
    terms: 'prepaid',
    // Paid in full at collection, which is the ordinary counter case.
    paidInFull: true,
    source: 'counter',
  },
  {
    chain: 'quoted-invoiced',
    customer: { name: 'David Reyes', phone: '+1 6045550118', email: 'david.reyes@example.ca' },
    device: { category: 'Phone', brand: 'Samsung', series: 'Galaxy S23', model: 'Galaxy S23 Ultra', serial: 'RF8N70QK4TW' },
    problem: 'Cracked panel after a drop; touch dead along the left third.',
    solution: 'Panel and digitiser replaced, frame trued, touch verified across the full surface.',
    services: ['screen', 'diagnostic'],
    quotedDaysAgo: 19,
    openedDaysAgo: 17,
    closedDaysAgo: 12,
    terms: 'net15',
    // Deposit at drop-off, balance still outstanding — the invoice reads
    // partially paid, which is a state the invoice screen has to render.
    depositCents: 10_000,
    paidInFull: false,
    source: 'phone',
  },
  {
    chain: 'quoted-invoiced',
    customer: { name: 'Hana Park', phone: '+1 4165550142', email: 'hana.park@example.ca' },
    device: { category: 'Phone', brand: 'Google', series: 'Pixel 8', model: 'Pixel 8 Pro', serial: 'GP8P2244HN' },
    problem: 'No charge on any cable; port lint-packed and one pin lifted.',
    solution: 'Port assembly replaced and the lifted pad rebuilt. Fast charge confirmed at 27W.',
    services: ['charging', 'board'],
    quotedDaysAgo: 34,
    openedDaysAgo: 31,
    closedDaysAgo: 25,
    terms: 'prepaid',
    paidInFull: true,
    source: 'counter',
  },

  // ---- quoted, still on the bench ------------------------------------------
  {
    chain: 'quoted-open',
    customer: { name: 'Michael Reyes', phone: '+1 9055550193', email: 'michael.reyes@example.ca' },
    device: { category: 'Phone', brand: 'Apple', series: 'iPhone 14', model: 'iPhone 14 Pro', serial: 'H4KM82PLQ9X' },
    problem: 'Dropped in a sink. Powers on, screen flickers, no rear camera.',
    services: ['water', 'camera'],
    quotedDaysAgo: 9,
    openedDaysAgo: 7,
    status: 'waiting_for_parts',
    priority: 'high',
    source: 'counter',
  },
  {
    chain: 'quoted-open',
    customer: { name: 'Sofia Nguyen', phone: '+1 5195550166', email: 'sofia.nguyen@example.ca' },
    device: { category: 'Tablet', brand: 'Apple', series: 'iPad Air', model: 'iPad Air (5th gen)', serial: 'DMPX44JH1LK' },
    problem: 'Screen lifting at the top-left corner; battery suspected swollen.',
    services: ['battery', 'screen'],
    quotedDaysAgo: 5,
    openedDaysAgo: 3,
    status: 'processing',
    priority: 'urgent',
    source: 'web',
  },

  // ---- walk-ins with no quote ----------------------------------------------
  // The lineage strip must show Ticket -> Invoice and NO quote station.
  {
    chain: 'walkin-invoiced',
    customer: { name: 'Owen Fitzgerald', phone: '+1 4165550177' },
    device: { category: 'Phone', brand: 'Apple', series: 'iPhone 12', model: 'iPhone 12', serial: 'C39QR7TT0KD' },
    problem: 'Speaker crackles on calls.',
    solution: 'Loudspeaker module replaced; call and media audio verified.',
    services: ['speaker'],
    openedDaysAgo: 15,
    closedDaysAgo: 13,
    terms: 'prepaid',
    paidInFull: true,
    source: 'counter',
  },
  {
    chain: 'walkin-invoiced',
    customer: { name: 'Chen Davis', phone: '+1 7785550129', email: 'chen.davis@example.ca' },
    device: { category: 'Laptop', brand: 'Apple', series: 'MacBook Pro', model: 'MacBook Pro 14 (M2)', serial: 'FVFXK2LMQ6LR' },
    problem: 'Will not wake from sleep; intermittent no-boot.',
    solution: 'Board reflow on the PMIC line and a clean reinstall. 48-hour soak passed.',
    services: ['board', 'diagnostic'],
    openedDaysAgo: 22,
    closedDaysAgo: 16,
    terms: 'net30',
    paidInFull: false,
    source: 'phone',
  },

  // ---- open walk-ins, no quote and no invoice yet ---------------------------
  // The board needs rows in the earlier stages, and these are also what the
  // "no quote, invoice still pending" lineage looks like.
  {
    chain: 'walkin-open',
    customer: { name: 'Aayush Yadav', phone: '+1 9336523862' },
    device: { category: 'Phone', brand: 'Apple', series: 'iPhone 15', model: 'iPhone 15 Pro Max', serial: 'J7NP01WWQ2A' },
    problem: 'Battery drains within a few hours.',
    services: ['diagnostic'],
    openedDaysAgo: 1,
    status: 'diagnosis',
    source: 'kiosk',
  },
  {
    chain: 'walkin-open',
    customer: { name: 'Priya Brown', phone: '+1 6135550151', email: 'priya.brown@example.ca' },
    device: { category: 'Phone', brand: 'Samsung', series: 'Galaxy A54', model: 'Galaxy A54', serial: 'R58T90KKPQZ' },
    problem: 'Back glass shattered, camera lens intact.',
    services: ['screen'],
    openedDaysAgo: 4,
    status: 'ready_to_repair',
    source: 'counter',
  },
  {
    chain: 'walkin-open',
    customer: { name: 'Marcus Bell', phone: '+1 9025550184' },
    device: { category: 'Phone', brand: 'OnePlus', series: 'Nord 4', model: 'Nord 4', serial: 'ON4X22LLQ8B' },
    problem: 'Charging port lint-blocked, intermittent connection.',
    solution: 'Port cleaned and reseated; charge verified.',
    services: ['charging'],
    openedDaysAgo: 6,
    status: 'ready_to_pickup',
    source: 'counter',
  },
  {
    chain: 'walkin-open',
    customer: { name: 'Leila Haddad', phone: '+1 5145550163' },
    device: { category: 'Phone', brand: 'Xiaomi', series: 'Redmi Note 13', model: 'Redmi Note 13 Pro', serial: 'XR13N55QQ1C' },
    problem: 'Screen replacement quoted, customer declined the price.',
    services: ['diagnostic'],
    openedDaysAgo: 30,
    closedDaysAgo: 29,
    status: 'cancelled',
    priority: 'low',
    source: 'counter',
  },
  // Over the 7-day SLA and still open, so the Age column's warning treatment
  // has something to render.
  {
    chain: 'walkin-open',
    customer: { name: 'Dana Whitfield', phone: '+1 2505550137', email: 'dana.whitfield@example.ca' },
    device: { category: 'Phone', brand: 'Apple', series: 'iPhone 11', model: 'iPhone 11', serial: 'DW11X88QQ4E' },
    problem: 'No service after a third-party screen fit elsewhere.',
    services: ['diagnostic', 'board'],
    openedDaysAgo: 21,
    status: 'retention_policy',
    priority: 'low',
    source: 'counter',
  },
];

/** `TKT-2026-00001` and friends. */
function pad(n) {
  return String(n).padStart(5, '0');
}

/**
 * Lines for one plan, as the ticket model stores them.
 *
 * A named service is labour and carries no product; where the plan's work
 * implies a stocked part, one is drawn from the catalogue so the ticket has a
 * line that genuinely points at inventory. Nothing hard-codes a SKU.
 */
function buildLines(plan, parts) {
  const services = plan.services.map((key) => ({ ...SERVICES[key] }));

  // One catalogue part per plan at most, chosen by rotation rather than by
  // name — the catalogue is regenerated and a name lookup would break with it.
  const part = parts.length ? parts[plan.partIndex % parts.length] : null;

  return {
    services,
    parts: part
      ? [
          {
            name: part.name,
            priceCents: Math.max(1, part.price),
            qty: 1,
            product: part._id,
            // Not stored on a ticket line — the model has no `sku` — but the
            // quote builder reads it to give its part line the catalogue's own
            // code rather than a synthetic one.
            sku: part.sku,
          },
        ]
      : [],
  };
}

/** The same arithmetic `ticketService.priceTicket` applies. */
function priceLines({ services, parts }, taxRate) {
  const gross = [...services, ...parts].reduce(
    (sum, line) => sum + line.priceCents * (line.qty ?? 1),
    0,
  );
  const taxCents = Math.round(gross * (taxRate / 100));
  return { gross, taxCents, total: gross + taxCents };
}

/**
 * Build every repair chain.
 *
 * Returns the three collections' rows already linked to each other, plus the
 * numbers used, so the caller can insert them in dependency order and report
 * what it made. Nothing is written here — the caller owns the database.
 *
 * @param products   the seeded catalogue, for the part lines
 * @param users      approved buyers, so some repairs belong to a real account
 * @param staff      technicians to assign
 * @param taxRate    the provincial rate, as a percentage
 * @param quoteSeq   the next free quote sequence number — repair quotes share
 *                   the `QT-` series with the goods quotes, and the number is
 *                   uniquely indexed, so the two builders cannot both start at 1
 * @param invoiceSeq the next free invoice sequence number
 */
function buildRepairs({
  products = [],
  users = [],
  staff = [],
  taxRate = 13,
  year = new Date().getFullYear(),
  quoteSeq = 1,
  invoiceSeq = 1,
}) {
  // Parts a repair would actually fit, rather than the whole catalogue.
  const parts = products.filter((product) => product.price > 0).slice(0, 40);

  const quotes = [];
  const tickets = [];
  const invoices = [];

  let quoteNumber = quoteSeq;
  let ticketNumber = 1;
  let invoiceNumber = invoiceSeq;

  REPAIR_PLANS.forEach((rawPlan, index) => {
    const plan = { ...rawPlan, partIndex: index };
    const quoted = plan.chain.startsWith('quoted');
    const invoiced = plan.chain.endsWith('invoiced');

    const lines = buildLines(plan, parts);
    const priced = priceLines(lines, taxRate);

    // The ticket and invoice line schemas have no `sku` — that field exists on
    // the line only so the quote builder can label its part with the
    // catalogue's own code. Dropped here rather than left for mongoose to
    // strip silently, so the shape written is the shape intended.
    const deviceParts = lines.parts.map(({ sku, ...part }) => part);

    const openedAt = daysAgo(plan.openedDaysAgo);
    const closedAt = plan.closedDaysAgo != null ? daysAgo(plan.closedDaysAgo) : null;

    // A repair belongs to an account only when the customer's email matches a
    // seeded buyer. A walk-in without an account is the common case and must
    // stay possible — `convertToInvoice` refuses one, which is itself worth
    // being able to see.
    const account =
      plan.customer.email
        ? users.find((user) => user.email === plan.customer.email) ?? null
        : null;

    /**
     * A quoted or invoiced repair needs an account behind it.
     *
     * `Quote.user` is required and `convertToInvoice` refuses a ticket with no
     * customer — an invoice is raised *against* somebody. So a repair that
     * carries either record is attached to a seeded buyer by rotation where its
     * own customer has no account of their own.
     *
     * An open walk-in keeps `null`, which is the point: a counter repair for
     * somebody with no account is the ordinary case, and a demo where every
     * ticket has an account never shows it.
     */
    const owner =
      account ?? ((quoted || invoiced) && users.length ? users[index % users.length] : null);

    const ticketId = `TKT-${year}-${pad(ticketNumber)}`;

    // ---- the quote, where there is one -------------------------------------
    let quote = null;
    if (quoted) {
      const quotedAt = daysAgo(plan.quotedDaysAgo);
      const quoteId = `QT-${year}-${pad(quoteNumber)}`;

      quote = {
        quoteNumber: quoteId,
        user: owner?._id ?? null,
        /**
         * A repair quote prices the whole job — labour AND the parts it needs
         * — at the prices the ticket then charges.
         *
         * Quoting only the services made every quote read short against the
         * ticket it became, which is precisely the drift the quote screen
         * exists to warn about; a demo where that gap is *normal* teaches the
         * operator to ignore the warning. A part line carries its catalogue
         * SKU, a labour line a synthetic `SVC-` one, because labour has no SKU.
         */
        items: [
          ...lines.services.map((service) => ({
            sku: `SVC-${service.name.split(' ')[0].toUpperCase().slice(0, 8)}`,
            name: service.name,
            qty: 1,
            unitPrice: service.priceCents,
            lineTotal: service.priceCents,
          })),
          ...lines.parts.map((part) => ({
            product: part.product,
            sku: part.sku ?? 'PART',
            name: part.name,
            qty: part.qty ?? 1,
            unitPrice: part.priceCents,
            lineTotal: part.priceCents * (part.qty ?? 1),
          })),
        ],
        subtotal: priced.gross,
        shipping: 0,
        tax: priced.taxCents,
        validUntil: daysAgo(plan.quotedDaysAgo - 30),
        notes: plan.problem,
        status: 'converted',
        // Both ends of the edge, exactly as `convertQuoteToTicket` writes them.
        convertedTicketNumber: ticketId,
        timeline: [
          { status: 'draft', at: quotedAt, note: 'Quote raised at the counter.' },
          { status: 'sent', at: quotedAt, note: 'Sent to the customer.' },
          { status: 'accepted', at: openedAt, note: 'Customer accepted.' },
          { status: 'converted', at: openedAt, note: `Became ticket ${ticketId}.` },
        ],
        createdAt: quotedAt,
      };
      quote.total = quote.subtotal + quote.tax;
      quotes.push(quote);
      quoteNumber += 1;
    }

    // ---- the ticket ---------------------------------------------------------
    // An invoiced repair is completed by definition; only an open one takes its
    // stage from the plan.
    const status = invoiced ? 'completed' : plan.status;

    // The stages this repair actually passed through, so the timeline and the
    // life-cycle strip agree about how far it got.
    const ladder = invoiced
      ? ['diagnosis', 'processing', 'ready_to_pickup', 'completed']
      : status === 'cancelled'
        ? ['diagnosis', 'cancelled']
        : ['diagnosis', status].filter((value, i, all) => all.indexOf(value) === i);

    const span = Math.max(1, plan.openedDaysAgo - (plan.closedDaysAgo ?? 0));
    const timeline = ladder.map((stage, i) => ({
      status: stage,
      at: daysAgo(plan.openedDaysAgo - Math.round((span * i) / Math.max(1, ladder.length - 1))),
      note:
        i === 0
          ? quoted
            ? `Created from quote ${quotes[quotes.length - 1].quoteNumber}.`
            : 'Taken in at the counter.'
          : null,
    }));

    tickets.push({
      ticketNumber: ticketId,
      quoteNumber: quote?.quoteNumber ?? null,

      user: owner?._id ?? null,
      customerName: plan.customer.name,
      customerPhone: plan.customer.phone,
      customerEmail: plan.customer.email ?? '',

      // Both shapes, as `shapeDevicesIn` writes them: the list screen reads the
      // flat fields and the detail screen reads the array.
      deviceBrand: plan.device.brand,
      deviceModel: plan.device.model,
      deviceSerial: plan.device.serial,
      issue: plan.problem,

      devices: [
        {
          ...plan.device,
          problem: plan.problem,
          solution: plan.solution ?? undefined,
          services: lines.services,
          parts: deviceParts,
        },
      ],

      status,
      priority: plan.priority ?? 'normal',
      source: plan.source ?? 'counter',

      technician: staff.length ? staff[index % staff.length]._id : null,

      taxRate,
      taxCents: priced.taxCents,
      estimateCents: priced.total,
      finalCents: invoiced ? priced.total : 0,

      deposits: plan.depositCents
        ? [
            {
              amount: plan.depositCents,
              at: openedAt,
              method: 'card',
              note: 'Taken at drop-off.',
            },
          ]
        : [],

      // Filled in by the caller once the invoice has an id.
      invoiceNumber: invoiced ? `CVX-${year}-${pad(invoiceNumber)}` : null,

      closedAt: ['completed', 'cancelled'].includes(status) ? closedAt : null,
      timeline,
      createdAt: openedAt,
      updatedAt: closedAt ?? openedAt,
    });

    // ---- the invoice, where the repair was billed ---------------------------
    if (invoiced) {
      const issuedAt = closedAt ?? openedAt;
      const dueDate = new Date(issuedAt);
      dueDate.setDate(dueDate.getDate() + ({ prepaid: 0, net15: 15, net30: 30, net60: 60 }[plan.terms] ?? 0));

      // The deposit rides across as a real payment, exactly as
      // `convertToInvoice` does it, and the balance follows from the rows.
      const payments = [];
      if (plan.depositCents) {
        payments.push({
          amount: plan.depositCents,
          at: openedAt,
          method: 'card',
          reference: `Deposit on ${ticketId}`,
        });
      }
      if (plan.paidInFull) {
        const remaining = priced.total - (plan.depositCents ?? 0);
        if (remaining > 0) {
          payments.push({
            amount: remaining,
            at: issuedAt,
            method: 'card',
            reference: 'Paid at collection.',
          });
        }
      }

      const amountPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

      invoices.push({
        number: `CVX-${year}-${pad(invoiceNumber)}`,
        ticketNumber: ticketId,
        kind: amountPaid >= priced.total ? 'invoice' : 'due',
        user: owner?._id ?? null,
        amount: priced.total,
        amountPaid,
        issuedAt,
        dueDate,
        terms: plan.terms,
        status:
          amountPaid >= priced.total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid',
        settledAt: amountPaid >= priced.total ? issuedAt : undefined,
        reference: `Repair ${ticketId}`,

        devices: [
          {
            ...plan.device,
            problem: plan.problem,
            solution: plan.solution ?? undefined,
            services: lines.services,
            parts: deviceParts,
          },
        ],
        subtotalCents: priced.gross,
        discountCents: 0,
        taxPercent: taxRate,
        taxCents: priced.taxCents,

        payments,
        createdAt: issuedAt,
      });

      invoiceNumber += 1;
    }

    ticketNumber += 1;
  });

  return {
    quotes,
    tickets,
    invoices,
    nextQuoteSeq: quoteNumber,
    nextInvoiceSeq: invoiceNumber,
  };
}

export { REPAIR_PLANS, SERVICES, buildRepairs, daysAgo };
