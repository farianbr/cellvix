/**
 * Seed content for the blog, the FAQ and the offers page.
 *
 * Written as wholesale copy for a Canadian parts wholesaler rather than lorem —
 * the layouts have to be judged against text of a realistic length, and an
 * admin editing a seeded post should see the house voice, not filler.
 *
 * Post bodies use the small markup vocabulary in client/src/lib/richText.jsx:
 * `## heading`, `### subheading`, `- bullet`, `1. step`, `> note`, blank-line
 * paragraphs, `**bold**` and `` `code` ``. Never HTML.
 */

const day = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * day);
const daysFromNow = (n) => new Date(Date.now() + n * day);

const BLOG_POSTS = [
  {
    title: 'How to grade a pull screen before you fit it',
    slug: 'how-to-grade-a-pull-screen',
    excerpt:
      'Pull A and Pull B are not opinions. Here is the bench check we run on every returned assembly, and the four faults that decide the grade.',
    category: 'repair-guides',
    tags: ['grading', 'screens', 'quality'],
    author: { name: 'Marc Deveau', role: 'Quality lead, Toronto warehouse' },
    status: 'published',
    publishedAt: daysAgo(4),
    isFeatured: true,
    body: `Every screen that comes back into the Cellvix warehouse is graded by hand before it is listed. Buyers ask us often what separates a Pull A from a Pull B, so this is the exact bench sequence, in the order we run it.

## The four faults that set the grade

Grading is not a general impression of condition. It is four specific checks, and the worst result of the four is the grade.

- **Glass** — hairlines under a raking light, chips at the corner radius, any lift at the bezel.
- **Panel** — dead or stuck subpixels, burn-in on OLED, uneven backlight on LCD.
- **Touch** — a full-surface swipe with a test pattern, including the outer 3 mm where digitizers fail first.
- **Flex** — connector wear, kinks, and any evidence the cable has been peeled and re-seated.

### What each grade means in practice

**Pull A** passes all four with nothing visible at arm's length. It goes into a customer's phone and nobody asks a question about it.

**Pull B** has cosmetic marks that survive a wipe — light hairlines, a scuff outside the active area — but the panel, touch and flex are clean. It is the right part for a budget repair where the customer has been told what they are getting.

> A part that fails touch or panel is not a Pull B. It is scrap, and it never reaches the catalogue.

## Bench sequence

1. Clean the assembly with isopropyl and a lint-free cloth. Half of what looks like a hairline is adhesive residue.
2. Inspect under a raking LED at roughly 30 degrees. Straight-on light hides everything worth finding.
3. Power the panel on a test rig with a solid white, solid black and RGB sweep.
4. Run a full-surface touch pattern, then repeat it on the outer edge only.
5. Inspect the flex under magnification and check the connector for pin damage.

## Before you fit it

Two habits save more warranty claims than anything else on this list.

- Test the assembly on the bench **before** you take the customer's device apart. A DOA found at the counter costs you five minutes; the same DOA found at reassembly costs you the job.
- Photograph the screen powered on, with the SKU visible, the moment you open the box. If a claim ever happens, that photograph settles it in one message.

Every Cellvix assembly ships with a 30-day warranty as standard, and 90 days on NEW and OEM stock. Claims go through your account rep with the order number and that first photograph.`,
  },
  {
    title: 'Battery health, cycle counts and what to tell your customer',
    slug: 'battery-health-cycle-counts',
    excerpt:
      'A new battery that reads 94% is not faulty. Here is what the health figure actually measures, and how to explain it at the counter without losing the sale.',
    category: 'repair-guides',
    tags: ['batteries', 'diagnostics'],
    author: { name: 'Priya Raman', role: 'Technical support' },
    status: 'published',
    publishedAt: daysAgo(12),
    isFeatured: false,
    body: `The single most common support ticket we get is a shop reporting that a brand-new battery installed at less than 100% health. In almost every case the cell is fine, and the number on the screen is not measuring what the customer thinks it is.

## What the health percentage actually reports

Battery health is the operating system's *estimate* of maximum capacity against the original design capacity. It is derived, not measured directly, and it is calibrated over charge cycles. A freshly fitted cell has no cycle history on that device, so the estimate is a guess until it has been through a few full charges.

- A new aftermarket cell commonly reads between 92% and 100% on first boot.
- The figure usually settles upward after three to five full cycles.
- On devices with paired-battery authentication, a non-original cell may report no health figure at all, or show a service message. That is an authentication result, not a capacity result.

## What to tell the customer

Say it before the repair, not after. The wording that works:

> "This is a new cell with full runtime. The phone's health readout re-learns over the first week and may show a service note because the battery is not the original paired one. Runtime is what you will actually notice, and that is covered by the warranty."

Setting that expectation at intake turns a callback into a non-event.

## When it really is the cell

Send it back if any of these appear:

1. Runtime materially worse than the cell it replaced.
2. Shutdowns above 20% charge.
3. Any swelling, at any point, at any age.
4. Charging that stalls below full and does not resume.

Photograph the diagnostic screen and open the claim through your account rep with the order number.`,
  },
  {
    title: 'Net 30 terms: how Cellvix credit works',
    slug: 'net-30-terms-how-cellvix-credit-works',
    excerpt:
      'Approved accounts can order on terms instead of prepaying. What the credit limit means, how the balance moves, and how to get a limit raised.',
    category: 'business-tips',
    tags: ['credit', 'accounts', 'invoicing'],
    author: { name: 'Marc Deveau', role: 'Sales desk' },
    status: 'published',
    publishedAt: daysAgo(21),
    isFeatured: false,
    body: `Once your business is approved, the sales desk sets two things at the same time: a credit limit and payment terms. Both show on your dashboard under Credit.

## The moving parts

- **Credit limit** — the most you can have outstanding at once, in CAD.
- **Balance** — the total of your unpaid invoices right now.
- **Available** — the limit minus the balance. This is what a new order draws against.
- **Terms** — prepaid, Net 15, Net 30 or Net 60. Terms set the due date on every invoice we raise.

Placing an order on terms increases your balance immediately. Paying an invoice reduces it the day the payment lands.

## What happens at the limit

An order that would take you past your available credit is not silently rejected at checkout. The sales desk sees it, and you will get a call the same business day with two options: pay down an invoice, or prepay this one order by card. Nothing gets stuck.

## Getting a limit raised

Send your account rep a note with the volume you are planning and roughly when. Limits are reviewed on payment history first and time-as-a-customer second, so a clean twelve weeks on Net 30 is worth more than any document you can send us.

> Reseller certificate on file? Send it once and it applies to every future order — it is not per-order paperwork.`,
  },
  {
    title: 'What changed in the Cellvix catalogue this quarter',
    slug: 'catalogue-changes-this-quarter',
    excerpt:
      'New series coverage across foldables and current-gen tablets, a tightened grading scale, and the parts we have stopped stocking.',
    category: 'product-updates',
    tags: ['catalogue', 'stock'],
    author: { name: 'Cellvix', role: 'Product team' },
    status: 'published',
    publishedAt: daysAgo(33),
    isFeatured: false,
    body: `A short note on what moved in the catalogue, so your quoting is working from the current picture.

## Added

- Full screen and battery coverage for the current foldable series across both major brands.
- Digitizer glass for current-generation tablets, in NEW and AFTERMARKET.
- Laptop hinge sets and bottom covers for the two chassis families we were asked about most.

## Tightened

The grading scale is unchanged in name, but the Pull A threshold moved. Any hairline visible under raking light is now a Pull B. Nothing in the existing catalogue was re-graded downward without being re-inspected.

## Retired

Parts for devices we no longer see demand for are deactivated rather than deleted, so your past orders and invoices still read correctly. If a SKU you rely on has gone quiet, tell your rep before you re-source it — quiet usually means a supplier change, not an exit.`,
  },
  {
    title: 'Five ways repair shops lose margin on parts',
    slug: 'five-ways-repair-shops-lose-margin',
    excerpt:
      'None of them are the unit price. Freight stacking, grade mismatch and dead stock cost more than the line item you negotiated.',
    category: 'business-tips',
    tags: ['margin', 'operations'],
    author: { name: 'Priya Raman', role: 'Technical support' },
    status: 'published',
    publishedAt: daysAgo(48),
    isFeatured: false,
    body: `Shops negotiate hard on unit price and then give it back in five predictable places. In rough order of how much they cost:

## 1. Freight stacking

Three orders in a week is three shipping charges. Consolidating to one weekly order — with a quick-order pad, not a browse — usually pays for itself before the discount does.

## 2. Grade mismatch

Fitting a NEW assembly to a five-year-old device the customer is about to replace is margin donated. Match the grade to the device's remaining life and quote both options at the counter.

## 3. Dead stock

Parts bought "because they were cheap" for models you see twice a year. Buy against your actual ticket mix, not against the discount.

## 4. Untracked warranty claims

A claim you never filed is a part you paid for twice. File it the day it fails, with the order number.

## 5. Re-work

The most expensive of the five and the least tracked. Bench-test before disassembly, every time.

> If you only change one thing this month, make it the bench test. It is free and it removes the worst outcome on this list.`,
  },
  {
    title: 'Draft: winter shipping cut-offs',
    slug: 'draft-winter-shipping-cut-offs',
    excerpt:
      'Carrier cut-off dates for the winter period, and what to expect on remote-area deliveries.',
    category: 'industry-news',
    tags: ['shipping'],
    author: { name: 'Cellvix', role: 'Operations' },
    status: 'draft',
    publishedAt: null,
    isFeatured: false,
    body: `Placeholder while carrier dates are confirmed.

## Cut-offs

Dates to be confirmed with Purolator and Canada Post.

## Remote areas

Northern and remote postal codes add two to four business days through the winter period. Exact figures pending.`,
  },
];

const GENERAL_FAQS = [
  // ordering
  {
    question: 'Do I need an account to see prices?',
    answer:
      'Yes. Cellvix is wholesale-only, so pricing is visible to approved business accounts. Anyone can browse the full catalogue, search and read specifications without signing in — prices and ordering unlock once your business is approved.',
    category: 'ordering',
    order: 10,
  },
  {
    question: 'Is there a minimum order?',
    answer:
      'No minimum order value and no minimum quantity per line. Shipping is free over $500 CAD, which is the only threshold that changes what you pay.',
    category: 'ordering',
    order: 20,
  },
  {
    question: 'Can I order by SKU instead of browsing?',
    answer:
      'Yes. The quick order pad under Account accepts pasted SKU and quantity lines straight from a spreadsheet, adds everything that matches in one action, and lists back any SKU it could not find so nothing is dropped silently.',
    category: 'ordering',
    order: 30,
  },
  {
    question: 'Can I save a cart and come back to it?',
    answer:
      'Yes. Save the current cart from the cart panel, give it a name, and restore it later from Account. Recurring builds — a screen, battery and adhesive set for one model — are worth saving once and reusing.',
    category: 'ordering',
    order: 40,
  },

  // accounts
  {
    question: 'How long does account approval take?',
    answer:
      'Most applications are reviewed within one business day. You can sign in and build a cart while you wait; only checkout is gated. Nothing in your cart is lost when the approval lands.',
    category: 'accounts',
    order: 10,
  },
  {
    question: 'What do you need to approve my business?',
    answer:
      'Your legal business name, a contact, a business phone number and your tax or GST/HST registration number. A reseller certificate is optional but speeds up tax handling on later orders.',
    category: 'accounts',
    order: 20,
  },
  {
    question: 'My application was rejected. What now?',
    answer:
      'The rejection notice includes the reason. It is almost always missing or mismatched registration details rather than a decision about your business. Reply to the notice with the corrected information and the sales desk will re-open the review.',
    category: 'accounts',
    order: 30,
  },
  {
    question: 'Can more than one person use our account?',
    answer:
      'One login per business today. Multi-user accounts with per-buyer permissions are on the roadmap — tell your rep if you need it and we will flag your account when it ships.',
    category: 'accounts',
    order: 40,
  },

  // pricing
  {
    question: 'Are prices in Canadian dollars?',
    answer:
      'Yes. Every price, invoice and statement on Cellvix is in CAD, and GST/HST is calculated on Canadian orders at checkout.',
    category: 'pricing',
    order: 10,
  },
  {
    question: 'How do payment terms work?',
    answer:
      'Approved accounts are set to prepaid, Net 15, Net 30 or Net 60 by the sales desk. Ordering on terms raises an invoice with a due date and draws against your credit limit; the balance drops when the invoice is paid.',
    category: 'pricing',
    order: 20,
  },
  {
    question: 'Can I get my credit limit raised?',
    answer:
      'Send your account rep the volume you are planning and when. Limits are reviewed on payment history first, so a clean run of on-time invoices is the fastest route to a higher limit.',
    category: 'pricing',
    order: 30,
  },
  {
    question: 'Do you offer volume pricing?',
    answer:
      'Yes. Standing volume on a model family is priced by the sales desk rather than by a public tier table — send your rep the models and monthly quantities and you will get a quote against your own mix.',
    category: 'pricing',
    order: 40,
  },

  // shipping
  {
    question: 'Where do you ship from and how fast is it?',
    answer:
      'Everything ships from our Toronto warehouse. Ground service across Ontario and Quebec is typically one to two business days, the rest of Canada two to five, with remote postal codes adding a little more.',
    category: 'shipping',
    order: 10,
  },
  {
    question: 'What does shipping cost?',
    answer:
      'Flat-rate ground is $18.95 CAD and free on orders over $500. Express services are quoted at checkout against your postal code.',
    category: 'shipping',
    order: 20,
  },
  {
    question: 'When do I get a tracking number?',
    answer:
      'The moment the order moves to Shipped. Cellvix will not mark an order shipped without a carrier and tracking number attached, so a shipped status always has something to track behind it.',
    category: 'shipping',
    order: 30,
  },

  // returns
  {
    question: 'What is the warranty on parts?',
    answer:
      'Thirty days as standard, and ninety days on NEW and OEM stock, from the delivery date. The warranty covers functional failure of the part, not physical damage during fitting.',
    category: 'returns',
    order: 10,
  },
  {
    question: 'How do I file a warranty claim?',
    answer:
      'Send your account rep the order number, the SKU and a photograph or short video of the fault. Approved claims are replaced from stock; if the part is unavailable the value is credited to your account.',
    category: 'returns',
    order: 20,
  },
  {
    question: 'Can I return a part I ordered by mistake?',
    answer:
      'Unopened, unfitted parts can be returned within fourteen days in their original packaging. Contact your rep first for a return reference — parts arriving without one cannot be matched to your account.',
    category: 'returns',
    order: 30,
  },

  // products
  {
    question: 'What do the grades mean?',
    answer:
      'NEW is new stock. OEM is a genuine manufacturer part in service-pack condition. PULL-A is a tested pull with no cosmetic marks at arm’s length. PULL-B is a tested pull with visible cosmetic marks outside the active area. AFTERMARKET is a third-party equivalent quality-checked to Cellvix spec.',
    category: 'products',
    order: 10,
  },
  {
    question: 'Is every part tested?',
    answer:
      'Every pull and every aftermarket assembly is bench-tested before listing, and every order is quality-checked again at pick time before it is boxed.',
    category: 'products',
    order: 20,
  },
  {
    question: 'A part I need is not in the catalogue. Can you source it?',
    answer:
      'Often, yes. Send your rep the exact model and part and they will tell you whether it can be sourced and what the lead time looks like.',
    category: 'products',
    order: 30,
  },
];

/**
 * Product-scoped FAQs.
 *
 * An entry with neither `partType` nor `deviceTypeSlug` shows on every product
 * page; the targeted ones sort above them. That is how all 420 SKUs get a
 * useful FAQ section without 420 authored entries.
 */
const PRODUCT_FAQS = [
  {
    question: 'Is {product} tested before it ships?',
    answer:
      'Yes. This part is bench-tested when it is listed and quality-checked again at pick time, before it goes in the box.',
    category: 'products',
    partType: '',
    deviceTypeSlug: '',
    order: 10,
  },
  {
    question: 'What warranty comes with this part?',
    answer:
      'Thirty days as standard from delivery, and ninety days on NEW and OEM stock. The warranty covers functional failure, not damage during fitting.',
    category: 'returns',
    partType: '',
    deviceTypeSlug: '',
    order: 20,
  },
  {
    question: 'Will this fit anything other than the {model}?',
    answer:
      'Assume not. Fitment is listed per model because assemblies that look identical often differ in flex routing or connector position. If you need a cross-reference, send your rep the exact model.',
    category: 'products',
    partType: '',
    deviceTypeSlug: '',
    order: 30,
  },
  {
    question: 'How fast does this ship?',
    answer:
      'In-stock parts ordered before 3:00 PM ET ship the same business day from Toronto. Ground service is one to two business days in Ontario and Quebec, two to five elsewhere in Canada.',
    category: 'shipping',
    partType: '',
    deviceTypeSlug: '',
    order: 40,
  },
  {
    question: 'It says out of stock — can I still order it?',
    answer:
      'Not through checkout. Ask your account rep to place a backorder: they can tell you the incoming quantity and the expected date for this specific SKU rather than a generic estimate.',
    category: 'ordering',
    partType: '',
    deviceTypeSlug: '',
    order: 50,
  },
  {
    question: 'Does this screen come with the frame and small parts attached?',
    answer:
      'Screen assemblies ship as the panel, digitizer and frame together. Earpiece mesh, proximity brackets and camera brackets are not transferred — move them across from the original assembly.',
    category: 'products',
    partType: 'screen-assembly',
    deviceTypeSlug: '',
    order: 5,
  },
  {
    question: 'Will the phone report a non-genuine display message?',
    answer:
      'On devices that pair the display to the board, any replacement that is not the original paired panel can raise a service notice. It is an authentication result, not a fault, and it does not affect display or touch. Tell the customer before the repair.',
    category: 'products',
    partType: 'screen-assembly',
    deviceTypeSlug: '',
    order: 6,
  },
  {
    question: 'Why does a new battery not read 100% health?',
    answer:
      'The health figure is the operating system’s estimate against design capacity, and it re-learns over the first few charge cycles. A new cell commonly reads 92–100% on first boot and settles upward. Judge it on runtime, which is what the warranty covers.',
    category: 'products',
    partType: 'battery',
    deviceTypeSlug: '',
    order: 5,
  },
  {
    question: 'Is adhesive included with this battery?',
    answer:
      'Battery adhesive strips are supplied with NEW and OEM cells. Pulls and aftermarket cells ship without adhesive — order it as a separate line if you need it.',
    category: 'products',
    partType: 'battery',
    deviceTypeSlug: '',
    order: 6,
  },
  {
    question: 'Does the charging port flex need soldering?',
    answer:
      'No. Every charging port flex in the catalogue is a plug-in assembly for its model. If your model needs a soldered port, it is listed separately and the description says so.',
    category: 'products',
    partType: 'charging-port',
    deviceTypeSlug: '',
    order: 5,
  },
  {
    question: 'Is this laptop panel a matte or glossy finish?',
    answer:
      'The finish is listed in the specifications on this page. Where a chassis shipped in both, Cellvix lists them as separate SKUs so there is nothing to guess at.',
    category: 'products',
    partType: 'screen-assembly',
    deviceTypeSlug: 'laptop',
    order: 5,
  },
];

/**
 * Offers are built from the seeded catalogue rather than hardcoded SKUs — the
 * generator's sequence numbers move whenever the catalogue changes shape, and a
 * combo pointing at a SKU that no longer exists is exactly the broken card the
 * write-time SKU check exists to prevent.
 */
function buildOffers(products) {
  const inStock = products.filter((product) => product.stock > 0);

  /**
   * A combo is only honest if every part in it fits the same device. The
   * generator gives each model a random subset of part types, so the model has
   * to be chosen by what it actually carries — picking a screen first and then
   * hunting for "a battery" produced a bundle that advertised one phone and
   * shipped a cell for another.
   */
  const byModel = new Map();
  for (const product of inStock) {
    if (!byModel.has(product.modelSlug)) byModel.set(product.modelSlug, []);
    byModel.get(product.modelSlug).push(product);
  }

  const modelWith = (deviceTypeSlug, requiredParts, skip = 0) => {
    let seen = 0;
    for (const [, parts] of byModel) {
      if (parts[0].deviceTypeSlug !== deviceTypeSlug) continue;
      const found = requiredParts.map((slug) => parts.find((p) => p.partType === slug));
      if (found.some((p) => !p)) continue;
      if (seen++ < skip) continue;
      return found;
    }
    return null;
  };

  const [screen, battery, port] =
    modelWith('smartphone', ['screen-assembly', 'battery', 'charging-port']) ?? [];
  // Its own model pair, so the volume combo is not a second bundle for the same
  // phone as the featured one.
  const [volumeScreen, volumeBackGlass] =
    modelWith('smartphone', ['screen-assembly', 'back-glass'], 1) ?? [];
  const [tabletScreen, tabletBattery] = modelWith('tablet', ['screen-assembly', 'battery']) ?? [];
  const [laptopPanel, laptopBattery] = modelWith('laptop', ['screen-assembly', 'battery']) ?? [];

  const bundle = (items, discount) => {
    const regular = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    // Round to the nearest dollar — a bundle priced at $237.41 reads as an
    // arithmetic result, not as an offer.
    return Math.round((regular * (1 - discount)) / 100) * 100;
  };

  const offers = [];

  if (screen && battery && port) {
    const items = [
      { product: screen, qty: 1 },
      { product: battery, qty: 1 },
      { product: port, qty: 1 },
    ];
    offers.push({
      title: 'Full refresh combo',
      slug: 'full-refresh-combo',
      subtitle: `Screen, battery and charging port for the ${screen.modelName}`,
      description:
        'The three parts that come through the door together. One line on the invoice, one shipping charge, and the same bench-tested stock as the individual SKUs.',
      kind: 'combo',
      badge: 'Best value',
      accent: 'brand',
      items: items.map((item) => ({ sku: item.product.sku, qty: item.qty })),
      bundlePrice: bundle(items, 0.14),
      terms: 'While stock lasts. Combo pricing applies to the bundle as listed and cannot be split.',
      isFeatured: true,
      isActive: true,
      order: 0,
      endsAt: daysFromNow(21),
    });
  }

  if (tabletScreen && tabletBattery) {
    const items = [
      { product: tabletScreen, qty: 1 },
      { product: tabletBattery, qty: 1 },
    ];
    offers.push({
      title: 'Tablet bench pair',
      slug: 'tablet-bench-pair',
      subtitle: `Screen and battery for the ${tabletScreen.modelName}`,
      description:
        'Tablet repairs almost always take both. Ordering them as a pair saves a second freight charge and a second pick.',
      kind: 'combo',
      badge: 'Combo',
      accent: 'info',
      items: items.map((item) => ({ sku: item.product.sku, qty: item.qty })),
      bundlePrice: bundle(items, 0.11),
      terms: 'While stock lasts.',
      isActive: true,
      order: 1,
      endsAt: daysFromNow(30),
    });
  }

  if (laptopPanel && laptopBattery) {
    const items = [
      { product: laptopPanel, qty: 1 },
      { product: laptopBattery, qty: 1 },
    ];
    offers.push({
      title: 'Laptop revival kit',
      slug: 'laptop-revival-kit',
      subtitle: `Panel and battery for the ${laptopPanel.modelName}`,
      description:
        'The two parts that decide whether a laptop repair is worth quoting. Priced together so the quote clears.',
      kind: 'combo',
      badge: 'Combo',
      accent: 'ok',
      items: items.map((item) => ({ sku: item.product.sku, qty: item.qty })),
      bundlePrice: bundle(items, 0.1),
      terms: 'While stock lasts.',
      isActive: true,
      order: 2,
      endsAt: daysFromNow(45),
    });
  }

  if (volumeScreen && volumeBackGlass) {
    const items = [
      { product: volumeScreen, qty: 2 },
      { product: volumeBackGlass, qty: 2 },
    ];
    offers.push({
      title: 'Front and back, twice over',
      slug: 'front-and-back-twice-over',
      subtitle: `Two screens and two back glass panels for the ${volumeScreen.modelName}`,
      description:
        'For shops running the same repair twice a week. Two of each, one line, one freight charge.',
      kind: 'combo',
      badge: 'Volume',
      accent: 'warn',
      items: items.map((item) => ({ sku: item.product.sku, qty: item.qty })),
      bundlePrice: bundle(items, 0.16),
      terms: 'While stock lasts. Quantities as listed.',
      isActive: true,
      order: 3,
      endsAt: daysFromNow(14),
    });
  }

  offers.push(
    {
      title: '15% off every battery',
      slug: '15-off-every-battery',
      subtitle: 'Phone, tablet and laptop cells',
      description:
        'Stock up before the winter run. Applies to every battery in the catalogue, in every grade, with no minimum quantity.',
      kind: 'deal',
      badge: 'Save 15%',
      accent: 'ok',
      discountType: 'percent',
      discountPercent: 15,
      code: 'CELLS15',
      target: { partType: 'battery' },
      terms: 'Applies to battery SKUs only. Cannot be combined with combo pricing.',
      isActive: true,
      order: 10,
      endsAt: daysFromNow(18),
    },
    {
      title: 'Free freight on Samsung screens',
      slug: 'free-freight-samsung-screens',
      subtitle: 'Any order containing five or more Samsung screen assemblies',
      description:
        'Ground shipping is on us when your order carries five or more Samsung screen assemblies, at any order value.',
      kind: 'deal',
      badge: 'Free shipping',
      accent: 'info',
      discountType: 'free-shipping',
      minQty: 5,
      target: { brandSlug: 'samsung', partType: 'screen-assembly' },
      terms: 'Ground service within Canada. Express services are not included.',
      isActive: true,
      order: 11,
      endsAt: daysFromNow(25),
    },
    {
      title: '$40 off Pull A screen assemblies',
      slug: '40-off-pull-a-screens',
      subtitle: 'On orders over $750',
      description:
        'Tested pulls with no cosmetic marks at arm’s length — the grade most shops fit by default. $40 off when your order clears $750.',
      kind: 'deal',
      badge: 'Save $40',
      accent: 'brand',
      discountType: 'amount',
      discountAmount: 4000,
      minSpend: 75_000,
      code: 'PULLA40',
      usageLimit: 200,
      target: { partType: 'screen-assembly', grade: 'PULL-A' },
      terms: 'One use per order. Applies before tax and shipping.',
      isActive: true,
      order: 12,
      endsAt: daysFromNow(12),
    },
    {
      title: '10% off your first order',
      slug: '10-off-first-order',
      subtitle: 'For newly approved wholesale accounts',
      description:
        'Newly approved businesses get 10% off their first order, on anything in the catalogue. Applied by the sales desk when the order is picked.',
      kind: 'deal',
      badge: 'New accounts',
      accent: 'brand',
      discountType: 'percent',
      discountPercent: 10,
      code: 'WELCOME10',
      target: {},
      // The one seeded offer that exercises single-use redemption end to end.
      redemption: 'single',
      terms: 'First order only, within 60 days of approval. Cannot be combined with combo pricing.',
      isActive: true,
      order: 13,
    },
    {
      title: 'Boxing week: 20% off aftermarket',
      slug: 'boxing-week-aftermarket',
      subtitle: 'Scheduled — starts later this month',
      description:
        'A scheduled promotion, held back until its start date. It does not appear on the offers page until then.',
      kind: 'deal',
      badge: 'Coming soon',
      accent: 'warn',
      discountType: 'percent',
      discountPercent: 20,
      target: { grade: 'AFTERMARKET' },
      terms: 'Aftermarket grade only.',
      isActive: true,
      order: 20,
      startsAt: daysFromNow(20),
      endsAt: daysFromNow(34),
    },
  );

  return offers;
}

// --- CommonJS exports -------------------------------------------------
exports.BLOG_POSTS = BLOG_POSTS;
exports.GENERAL_FAQS = GENERAL_FAQS;
exports.PRODUCT_FAQS = PRODUCT_FAQS;
exports.buildOffers = buildOffers;
