import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db.js';
import Taxonomy from '../models/Taxonomy.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Invoice from '../models/Invoice.js';
import CreditTransaction from '../models/CreditTransaction.js';
import BlogPost from '../models/BlogPost.js';
import Faq from '../models/Faq.js';
import Offer from '../models/Offer.js';
import Supplier from '../models/Supplier.js';
import Rfq from '../models/Rfq.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Expense from '../models/Expense.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import StockMovement from '../models/StockMovement.js';
import { buildTaxonomyDocs, buildProducts } from './generate.js';
import { BLOG_POSTS, GENERAL_FAQS, PRODUCT_FAQS, buildOffers } from './content.data.js';
import { EXPENSE_CATEGORIES } from './expense-categories.js';
import { SUPPLIERS, buildPurchaseOrders, buildExpenses, costFor } from './purchase.data.js';
import { seedRfqs } from './rfqs.js';
import Settings from '../models/Settings.js';
import Quote from '../models/Quote.js';
import Rma from '../models/Rma.js';
import { buildQuotes, buildRmas } from './sales.data.js';
import Role from '../models/Role.js';
import Outlet from '../models/Outlet.js';
import { ensureBuiltInRoles, ensureDefaultOutlet } from '../services/accessService.js';
import { ensureReferralCode } from '../services/referralService.js';

const DEMO_PASSWORD = 'Cellvix123!';

/** Mirrors blogService: read time is derived from the body, never authored. */
const readMinutes = (body) =>
  Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 220));

const DEMO_USERS = [
  {
    businessName: 'Northline Device Repair',
    contactName: 'Dana Whitfield',
    email: 'buyer@cellvix.ca',
    phone: '+1 (416) 555-0142',
    status: 'approved',
    role: 'buyer',
    taxId: 'RT0001-88213',
    businessType: 'Repair shop',
    website: 'northlinerepair.ca',
    creditLimit: 2_500_000,
    balance: 431_250,
    terms: 'net30',
    addresses: [
      {
        label: 'Warehouse',
        contactName: 'Dana Whitfield',
        company: 'Northline Device Repair',
        line1: '184 Bathurst St, Unit 3',
        city: 'Toronto',
        region: 'ON',
        postal: 'M5V 2R7',
        country: 'Canada',
        phone: '+1 (416) 555-0142',
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
      {
        label: 'Storefront',
        contactName: 'Priya Raman',
        company: 'Northline Device Repair',
        line1: '2210 Yonge St',
        city: 'Toronto',
        region: 'ON',
        postal: 'M4S 2C6',
        country: 'Canada',
        isDefaultShipping: false,
        isDefaultBilling: false,
      },
    ],
    paymentMethods: [
      { type: 'card', brand: 'Visa', last4: '4242', expMonth: 11, expYear: 2029, isDefault: true },
      { type: 'terms', isDefault: false },
    ],
    accountRep: { name: 'Marc Deveau', email: 'marc@cellvix.ca', phone: '+1 (416) 555-0110' },
  },
  {
    // Referred by Northline (wired up after the users are saved, since it needs
    // Northline's id). Gives the referrals screen a real pairing rather than
    // only ever being seen in its empty state.
    referredByEmail: 'buyer@cellvix.ca',
    businessName: 'Pixel Point Mobile',
    contactName: 'Sam Okafor',
    email: 'pending@cellvix.ca',
    phone: '+1 (604) 555-0188',
    status: 'pending',
    role: 'buyer',
    businessType: 'Retailer',
  },
  {
    businessName: 'Cellvix',
    contactName: 'Cellvix Admin',
    email: 'admin@cellvix.ca',
    phone: '+1 (416) 555-0100',
    status: 'approved',
    role: 'admin',
  },
  // One staff account per built-in role (§7.6), so the Users and Roles screens
  // have something real to render and each permission level can be tried by
  // signing in rather than by reading the code.
  {
    businessName: 'Cellvix',
    contactName: 'Priya Raman',
    email: 'priya@cellvix.ca',
    phone: '+1 (416) 555-0141',
    status: 'approved',
    role: 'staff',
    staffRoleSlug: 'account-manager',
  },
  {
    businessName: 'Cellvix',
    contactName: 'Marcus Webb',
    email: 'marcus@cellvix.ca',
    phone: '+1 (416) 555-0142',
    status: 'approved',
    role: 'staff',
    staffRoleSlug: 'warehouse',
  },
  {
    businessName: 'Cellvix',
    contactName: 'Dana Okafor',
    email: 'dana@cellvix.ca',
    phone: '+1 (416) 555-0143',
    status: 'approved',
    role: 'staff',
    staffRoleSlug: 'front-desk',
  },
  // Extra pending accounts so the admin approval queue is not empty.
  {
    businessName: 'Maritime Mobile Works',
    contactName: 'Elise Gagnon',
    email: 'elise@maritimemobile.ca',
    phone: '+1 (902) 555-0119',
    status: 'pending',
    role: 'buyer',
    businessType: 'Repair shop',
  },
  {
    businessName: 'Prairie Tech Supply',
    contactName: 'Jordan Reyes',
    email: 'jordan@prairietech.ca',
    phone: '+1 (306) 555-0164',
    status: 'pending',
    role: 'buyer',
    businessType: 'Distributor',
  },
  {
    businessName: 'Westcoast Screen Co.',
    contactName: 'Amrit Sandhu',
    email: 'amrit@westcoastscreen.ca',
    phone: '+1 (778) 555-0177',
    status: 'approved',
    role: 'buyer',
    creditLimit: 1_000_000,
    balance: 0,
    terms: 'net15',
    // The one opted-out account, so the Unsubscribes register is not only ever
    // seen empty and a campaign's "skipped" count is exercised for real.
    unsubscribed: true,
  },
];

const ORDER_HISTORY = [
  { daysAgo: 3, status: 'processing', itemCount: 4 },
  { daysAgo: 11, status: 'out_for_delivery', itemCount: 2 },
  { daysAgo: 24, status: 'delivered', itemCount: 6 },
  { daysAgo: 47, status: 'delivered', itemCount: 3 },
  { daysAgo: 68, status: 'delivered', itemCount: 5 },
];

const STATUS_SEQUENCE = ['placed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

const CARRIERS = [
  { carrier: 'Purolator', url: 'https://www.purolator.com/en/shipping/tracker' },
  { carrier: 'Canada Post', url: 'https://www.canadapost-postescanada.ca/track-reperage' },
  { carrier: 'FedEx Canada', url: 'https://www.fedex.com/fedextrack' },
];

/** Wipes and rebuilds every collection. Safe to run repeatedly. */
async function seedDatabase({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...args) => console.log(...args);

  await Promise.all([
    Taxonomy.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({}),
    Order.deleteMany({}),
    Invoice.deleteMany({}),
    CreditTransaction.deleteMany({}),
    BlogPost.deleteMany({}),
    Faq.deleteMany({}),
    Offer.deleteMany({}),
    // Phase 5. These reference products by id, so leaving them behind while
    // the catalogue is rebuilt would leave purchase orders pointing at parts
    // that no longer exist.
    Supplier.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    Expense.deleteMany({}),
    ExpenseCategory.deleteMany({}),
    StockMovement.deleteMany({}),
    // §6.8a. A request for quote holds product ids in its lines and supplier
    // ids in its invites, so leaving one behind while both are rebuilt would
    // leave a request asking suppliers who no longer exist about parts that no
    // longer exist.
    Rfq.deleteMany({}),
    // Phase 6. Dropped and recreated from defaults so a reseed cannot leave a
    // half-edited settings document behind; `Settings.load()` rebuilds it.
    Settings.deleteMany({}),

    // Phase 7. Quotes reference products and RMAs reference orders, so both
    // have to go when the catalogue is rebuilt.
    Quote.deleteMany({}),
    Rma.deleteMany({}),

    // Phase 8. Staff users reference both, so they are rebuilt with the users.
    Role.deleteMany({}),
    Outlet.deleteMany({}),
  ]);

  // ---- roles & outlet ------------------------------------------------------
  // Before users: a staff account cannot be created without a role to hold and
  // an outlet to stand in.
  await ensureBuiltInRoles();
  const defaultOutlet = await ensureDefaultOutlet();
  const rolesBySlug = new Map((await Role.find().lean()).map((r) => [r.slug, r]));
  log(`  roles: ${rolesBySlug.size} · outlet: ${defaultOutlet.code}`);

  // ---- taxonomy -----------------------------------------------------------
  const taxonomyDocs = buildTaxonomyDocs();
  const bySlug = new Map();

  // Insert level by level so each node's parent id already exists.
  for (const kind of ['deviceType', 'brand', 'series', 'model']) {
    const levelDocs = taxonomyDocs
      .filter((doc) => doc.kind === kind)
      .map(({ parentSlug, ...doc }) => ({
        ...doc,
        parent: parentSlug ? bySlug.get(parentSlug)._id : null,
      }));

    const inserted = await Taxonomy.insertMany(levelDocs);
    for (const doc of inserted) bySlug.set(doc.slug, doc);
  }
  log(`  taxonomy: ${bySlug.size} nodes`);

  // ---- products -----------------------------------------------------------
  const products = buildProducts({ targetCount: 420 });
  const insertedProducts = await Product.insertMany(products);
  log(`  products: ${insertedProducts.length}`);

  // Cache counts on the tree so the sidebar and mega menu can show them without
  // an aggregation on every request.
  const counts = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $facet: {
        deviceType: [{ $group: { _id: '$deviceTypeSlug', n: { $sum: 1 } } }],
        brand: [{ $group: { _id: '$brandSlug', n: { $sum: 1 } } }],
        series: [{ $group: { _id: '$seriesSlug', n: { $sum: 1 } } }],
        model: [{ $group: { _id: '$modelSlug', n: { $sum: 1 } } }],
      },
    },
  ]);

  const countOps = [];
  for (const group of Object.values(counts[0])) {
    for (const { _id, n } of group) {
      if (!_id) continue;
      countOps.push({ updateOne: { filter: { slug: _id }, update: { $set: { productCount: n } } } });
    }
  }
  if (countOps.length) await Taxonomy.bulkWrite(countOps);

  // ---- users --------------------------------------------------------------
  const users = [];
  for (const data of DEMO_USERS) {
    const { staffRoleSlug, unsubscribed, referredByEmail, ...fields } = data;
    const user = new User(fields);
    await user.setPassword(DEMO_PASSWORD);
    if (data.status === 'approved') user.approvedAt = new Date(Date.now() - 90 * 86_400_000);

    // CASL consent (§6.13). Buyers register through a form that records this;
    // seeded buyers get the same record so the marketing screens have a real
    // population to work with. Without it every campaign resolves to an empty
    // audience and the screens look broken when they are in fact correct —
    // consent is closed by default, and a seeded account is still an account.
    //
    // Staff and admin are Cellvix, not customers, and are never in an
    // audience, so they get no consent record at all.
    if (data.role === 'buyer') {
      user.marketingConsent = {
        granted: true,
        source: 'registration',
        at: new Date(Date.now() - 120 * 86_400_000),
      };
      // One account opts out, so the Unsubscribes register and the "skipped"
      // count on a campaign send both have something real to show. A screen
      // whose empty state is the only state it is ever seen in is a screen
      // nobody has actually checked.
      if (unsubscribed) user.unsubscribedAt = new Date(Date.now() - 14 * 86_400_000);
    }

    // Staff are Cellvix people: they hold a role and stand in an outlet. An
    // admin holds neither — it bypasses the role system by design (§7.6).
    if (staffRoleSlug) {
      user.staffRole = rolesBySlug.get(staffRoleSlug)?._id ?? null;
      user.outlet = defaultOutlet._id;
    }

    // Referral code, minted on approval exactly as `approveUser` does it
    // (§6.13) — a pending business does not get one.
    if (data.status === 'approved' && data.role === 'buyer') {
      await ensureReferralCode(user);
    }

    users.push(await user.save());
  }

  // Referral attribution, once every account exists — it points at another
  // user's id, so it cannot be set while that user is still being created.
  // Set here and never again: attribution is fixed at registration (§6.13).
  for (const data of DEMO_USERS) {
    if (!data.referredByEmail) continue;
    const referred = users.find((row) => row.email === data.email);
    const referrer = users.find((row) => row.email === data.referredByEmail);
    if (!referred || !referrer) continue;
    referred.referredBy = referrer._id;
    await referred.save();
  }

  const staffIds = users.filter((u) => u.role === 'staff').map((u) => u._id);
  if (staffIds.length) {
    await Outlet.updateOne({ _id: defaultOutlet._id }, { $set: { staff: staffIds } });
  }
  log(`  users: ${users.length} (staff: ${staffIds.length})`);

  // ---- orders + invoices for the primary demo buyer ------------------------
  const buyer = users.find((u) => u.email === 'buyer@cellvix.ca');
  const inStock = insertedProducts.filter((p) => p.stock > 0);
  const orders = [];
  const invoices = [];

  ORDER_HISTORY.forEach((spec, index) => {
    const placedAt = new Date(Date.now() - spec.daysAgo * 86_400_000);
    const picks = Array.from({ length: spec.itemCount }, (_, i) => {
      // Deterministic spread through the catalogue, not random.
      return inStock[(index * 37 + i * 53) % inStock.length];
    });

    const items = picks.map((product, i) => {
      const qty = 1 + ((index + i) % 5);
      return {
        product: product._id,
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        grade: product.grade,
        // Carried so order history renders the same part illustration as the
        // grid — without these the account page falls back to a generic drawing.
        partType: product.partType,
        partTypeLabel: product.partTypeLabel,
        qty,
        unitPrice: product.price,
        lineTotal: product.price * qty,
        // Cost snapshotted at order time (§9.4), so the reports have a real
        // margin to compute rather than treating every seeded line as pure
        // profit. Same grade-aware ratio the purchase seed uses, so a part's
        // sale cost and its purchase cost tell the same story.
        unitCost: costFor(product),
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const shipping = subtotal > 50_000 ? 0 : 1895;
    const tax = Math.round((subtotal + shipping) * 0.13); // placeholder HST, see PROGRESS.md Q4
    const total = subtotal + shipping + tax;

    const reached = STATUS_SEQUENCE.slice(0, STATUS_SEQUENCE.indexOf(spec.status) + 1);
    const timeline = reached.map((status, i) => ({
      status,
      at: new Date(placedAt.getTime() + i * 26 * 3_600_000),
      note:
        status === 'placed'
          ? 'Order received and confirmed.'
          : status === 'processing'
            ? 'Picking and quality-checking parts at the Toronto warehouse.'
            : status === 'shipped'
              ? 'Handed to the carrier.'
              : status === 'out_for_delivery'
                ? 'On the delivery vehicle.'
                : 'Signed for at the delivery address.',
    }));

    const carrier = CARRIERS[index % CARRIERS.length];
    const shipped = reached.includes('shipped');

    orders.push({
      orderNumber: `CVX-2026-${String(10_042 + index).padStart(5, '0')}`,
      user: buyer._id,
      items,
      subtotal,
      shipping,
      tax,
      total,
      status: spec.status,
      timeline,
      createdAt: placedAt,
      shippingAddress: {
        contactName: buyer.contactName,
        company: buyer.businessName,
        line1: buyer.addresses[0].line1,
        city: buyer.addresses[0].city,
        region: buyer.addresses[0].region,
        postal: buyer.addresses[0].postal,
        country: 'Canada',
        phone: buyer.phone,
      },
      billingAddress: {
        contactName: buyer.contactName,
        company: buyer.businessName,
        line1: buyer.addresses[0].line1,
        city: buyer.addresses[0].city,
        region: buyer.addresses[0].region,
        postal: buyer.addresses[0].postal,
        country: 'Canada',
      },
      deliveryMethod: { code: 'ground', label: 'Ground — 2 to 4 business days', cost: shipping, etaDays: 3 },
      poNumber: `PO-${4400 + index}`,
      payment: {
        method: index % 2 === 0 ? 'terms' : 'card',
        status: spec.status === 'delivered' ? 'paid' : 'pending',
        mockRef: `mock_${placedAt.getTime()}`,
        paidAt: spec.status === 'delivered' ? placedAt : undefined,
      },
      tracking: shipped
        ? { carrier: carrier.carrier, number: `CVX${9_100_000 + index * 7311}`, url: carrier.url }
        : undefined,
    });
  });

  const insertedOrders = await Order.insertMany(orders);
  log(`  orders: ${insertedOrders.length}`);

  insertedOrders.forEach((order, index) => {
    const issuedAt = order.createdAt;
    const dueDate = new Date(issuedAt.getTime() + 30 * 86_400_000);
    const paid = order.status === 'delivered';
    const overdue = !paid && dueDate < new Date();

    // A few days after the invoice went out, and never later than today.
    const settledAt = new Date(issuedAt.getTime() + (4 + (index % 9)) * 86_400_000);
    const paidAt = settledAt > new Date() ? new Date() : settledAt;

    invoices.push({
      number: `INV-2026-${String(10_042 + index).padStart(5, '0')}`,
      order: order._id,
      user: buyer._id,
      amount: order.total,
      amountPaid: paid ? order.total : 0,
      issuedAt,
      dueDate,
      terms: 'net30',
      status: paid ? 'paid' : overdue ? 'overdue' : 'unpaid',
      /**
       * Paid **somewhere between the issue date and now** — never on the due
       * date.
       *
       * Dating the payment `dueDate` was wrong twice. A Net-30 invoice raised
       * last week has a due date next month, so the seed wrote a payment
       * dated in the future: the account activity feed showed money arriving
       * on a day that has not happened. And it implied every customer pays
       * on the exact deadline, which made the collections figures meaningless.
       *
       * Clamped to `now` so a recently-issued invoice cannot produce a
       * future-dated payment however the window falls.
       */
      payments: paid
        ? [
            {
              amount: order.total,
              at: paidAt,
              method: 'EFT',
              reference: `EFT-${88_400 + index}`,
            },
          ]
        : [],
    });
  });

  await Invoice.insertMany(invoices);
  log(`  invoices: ${invoices.length}`);

  // ---- store credit --------------------------------------------------------
  // Seeded as a ledger, not as a number on the user, because that is how the
  // running system produces a balance: three movements that add up. The cached
  // balance on the account is written to match, exactly as storeCreditService
  // would have left it.
  const creditRows = [
    {
      amount: 25_000,
      type: 'recharge',
      note: 'Account top-up',
      daysAgo: 26,
      paymentRef: 'mock_card_TOPUP-seed',
    },
    {
      amount: 8_450,
      type: 'refund',
      note: `Refund for ${insertedOrders[2]?.orderNumber ?? 'a returned part'}`,
      order: insertedOrders[2]?._id,
      orderNumber: insertedOrders[2]?.orderNumber,
      daysAgo: 12,
    },
    {
      amount: -14_200,
      type: 'redemption',
      note: `Applied to ${insertedOrders[0]?.orderNumber ?? 'an order'}`,
      order: insertedOrders[0]?._id,
      orderNumber: insertedOrders[0]?.orderNumber,
      daysAgo: 4,
    },
  ];

  let creditRunning = 0;
  const creditDocs = creditRows.map((row) => {
    creditRunning += row.amount;
    return {
      user: buyer._id,
      amount: row.amount,
      balanceAfter: creditRunning,
      type: row.type,
      note: row.note,
      order: row.order,
      orderNumber: row.orderNumber,
      paymentRef: row.paymentRef,
      createdAt: new Date(Date.now() - row.daysAgo * 86_400_000),
    };
  });

  await CreditTransaction.insertMany(creditDocs);
  await User.updateOne({ _id: buyer._id }, { $set: { storeCredit: creditRunning } });
  log(`  store credit: ${creditDocs.length} movements, balance ${creditRunning}c`);

  // ---- editorial content ---------------------------------------------------
  const posts = await BlogPost.insertMany(
    BLOG_POSTS.map((post) => ({ ...post, readMinutes: readMinutes(post.body) })),
  );
  log(`  blog posts: ${posts.length}`);

  const faqs = await Faq.insertMany([
    ...GENERAL_FAQS.map((faq) => ({ ...faq, scope: 'general', isPublished: true })),
    ...PRODUCT_FAQS.map((faq) => ({ ...faq, scope: 'product', isPublished: true })),
  ]);
  log(`  faqs: ${faqs.length}`);

  const offers = await Offer.insertMany(buildOffers(insertedProducts));
  log(`  offers: ${offers.length}`);

  // ---- purchase (phase 5) -------------------------------------------------
  // Suppliers, purchase orders, the stock the received ones put on the shelf,
  // and the expenses. Written after the catalogue because every PO line and
  // every movement points at a product id.

  const categories = await ExpenseCategory.insertMany(EXPENSE_CATEGORIES);
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));
  log(`  expense categories: ${categories.length}`);

  const suppliers = await Supplier.insertMany(SUPPLIERS);
  const suppliersByCode = new Map(suppliers.map((supplier) => [supplier.code, supplier]));
  log(`  suppliers: ${suppliers.length}`);

  const year = new Date().getFullYear();
  const { orders: poDocs, movements: poMovements } = buildPurchaseOrders({
    products: insertedProducts,
    suppliersByCode,
    year,
  });

  // Received stock is added to what the catalogue generator already put on the
  // shelf, and `qtyAfter` is written from the running total rather than from
  // the receipt alone — a movement whose `qtyAfter` disagrees with the product
  // is precisely the reconciliation failure the ledger exists to make visible.
  const runningStock = new Map(
    insertedProducts.map((product) => [product._id.toString(), product.stock]),
  );

  const movementDocs = poMovements.map((movement) => {
    const key = movement.product.toString();
    const after = (runningStock.get(key) ?? 0) + movement.qtyChange;
    runningStock.set(key, after);
    return {
      product: movement.product,
      type: movement.type,
      qtyChange: movement.qtyChange,
      qtyAfter: after,
      unitCost: movement.unitCost,
      reference: movement.reference,
      createdAt: movement.createdAt,
      updatedAt: movement.createdAt,
    };
  });

  const insertedPos = await PurchaseOrder.insertMany(
    poDocs.map(({ _paid, _method, ...po }) => po),
  );
  log(`  purchase orders: ${insertedPos.length}`);

  // Point each movement at the purchase order that produced it, now that the
  // POs have ids, and give every received part its cost — a receipt is the
  // moment the true cost is known, which is what `receivePurchaseOrder` does.
  const poByNumber = new Map(insertedPos.map((po) => [po.poNumber, po]));
  for (const movement of movementDocs) {
    const po = poByNumber.get(movement.reference.label);
    if (po) movement.reference = { ...movement.reference, id: po._id };
  }

  if (movementDocs.length) await StockMovement.insertMany(movementDocs);
  log(`  stock movements: ${movementDocs.length}`);

  await Promise.all(
    [...runningStock.entries()].map(([id, stock]) => Product.updateOne({ _id: id }, { stock })),
  );

  const receivedCosts = new Map();
  for (const po of insertedPos) {
    for (const item of po.items) {
      if (item.qtyReceived > 0) receivedCosts.set(item.product.toString(), item.unitCost);
    }
  }
  await Promise.all(
    [...receivedCosts.entries()].map(([id, cost]) => Product.updateOne({ _id: id }, { cost })),
  );

  // The expenses a paid purchase order generated. Same shape the running code
  // writes, so the P&L cannot tell a seeded row from a real one.
  const purchaseCategory = categoriesBySlug.get('inventory-purchases');
  const poExpenses = [];
  let expenseSequence = 1;

  for (const [index, plan] of poDocs.entries()) {
    if (!plan._paid) continue;
    const po = insertedPos[index];
    const supplier = suppliers.find((row) => String(row._id) === String(po.supplier));

    poExpenses.push({
      number: `EXP-${year}-${String(expenseSequence).padStart(5, '0')}`,
      date: po.receivedDate ?? po.orderDate,
      description: `Purchase Order ${po.poNumber} — ${supplier?.name ?? 'supplier'}`,
      category: purchaseCategory._id,
      payee: supplier?.name,
      method: plan._method,
      status: 'paid',
      amount: po.total,
      tax: po.tax,
      taxIncluded: true,
      reference: po.poNumber,
      purchaseOrder: po._id,
    });
    expenseSequence += 1;
  }

  const insertedPoExpenses = poExpenses.length ? await Expense.insertMany(poExpenses) : [];

  // Close the loop the running code closes: a paid PO carries the expense its
  // payment created, so the two can never be counted twice.
  await Promise.all(
    insertedPoExpenses.map((expense) =>
      PurchaseOrder.updateOne(
        { _id: expense.purchaseOrder },
        {
          payment: {
            status: 'paid',
            method: expense.method,
            reference: expense.reference,
            paidAt: expense.date,
            expense: expense._id,
          },
        },
      ),
    ),
  );

  const manualExpenses = await Expense.insertMany(
    buildExpenses({ categoriesBySlug, year, startSequence: expenseSequence }),
  );
  log(`  expenses: ${insertedPoExpenses.length + manualExpenses.length}`);

  // Supplier card figures, recomputed from the orders exactly as
  // `purchaseService.refreshSupplierTotals` does — never incremented.
  await Promise.all(
    suppliers.map(async (supplier) => {
      const [row] = await PurchaseOrder.aggregate([
        {
          $match: {
            supplier: new mongoose.Types.ObjectId(String(supplier._id)),
            status: { $nin: ['draft', 'cancelled'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]);
      await Supplier.updateOne(
        { _id: supplier._id },
        { ordersCount: row?.count ?? 0, totalSpent: row?.total ?? 0 },
      );
    }),
  );

  // A default supplier, a reorder point and a cost per product, so Inventory
  // and the reports have something to show in those columns from the first run.
  //
  // Written for every product, not only the ones a purchase order touched: a
  // catalogue where most parts have no cost would make every margin figure in
  // phase 6 read as "mostly uncosted", which is true of the data but useless as
  // a demo. The receipts above still overwrite it with the real landed cost for
  // the parts that were actually delivered.
  await Promise.all(
    insertedProducts.map((product, index) =>
      Product.updateOne(
        { _id: product._id },
        {
          supplier: suppliers[index % 4]._id,
          minStock: [10, 15, 20, 25, 30][index % 5],
          ...(receivedCosts.has(product._id.toString()) ? {} : { cost: costFor(product) }),
        },
      ),
    ),
  );

  /**
   * The supplier process flow (§6.8a) — tags, portal logins and requests.
   *
   * Last of the purchase block, because it needs all of it: suppliers to tag
   * and invite, products to ask about, and a `cost` on each one to base a
   * plausible quote on. Awarding runs through `rfqService`, so the purchase
   * order it raises is a real one and the supplier totals recomputed above are
   * refreshed again by the service itself.
   */
  const rfqResult = await seedRfqs({ quiet: true });
  log(
    `  requests for quote: ${rfqResult.requests}` +
      ` (${rfqResult.tagged} suppliers tagged, ${rfqResult.credentialed} given portal access` +
      `${rfqResult.purchaseOrder ? `, awarded ${rfqResult.purchaseOrder}` : ''})`,
  );

  // The settings singleton, recreated from its seeded defaults — per-province
  // tax rates included, which the tax report reads (§9.5).
  const settings = await Settings.load();

  // ---- quotes & returns (phase 7) -----------------------------------------
  // Quotes are priced off the catalogue at a negotiated discount; returns are
  // built from real order lines, so a seeded RMA can never name a part that was
  // not actually sold — which is the rule `rmaService.createRma` enforces.

  const approvedBuyers = users.filter(
    (user) => user.status === 'approved' && user.role === 'buyer',
  );

  const quotes = await Quote.insertMany(
    buildQuotes({
      products: insertedProducts,
      users: approvedBuyers,
      rate: Settings.rateFor(settings, 'ON'),
    }),
  );
  log(`  quotes: ${quotes.length}`);

  const rmas = await Rma.insertMany(buildRmas({ orders: insertedOrders }));
  log(`  returns: ${rmas.length}`);

  return {
    taxonomy: bySlug.size,
    products: insertedProducts.length,
    users: users.length,
    orders: insertedOrders.length,
    invoices: invoices.length,
    storeCreditMovements: creditDocs.length,
    posts: posts.length,
    faqs: faqs.length,
    offers: offers.length,
    suppliers: suppliers.length,
    purchaseOrders: insertedPos.length,
    expenseCategories: categories.length,
    expenses: insertedPoExpenses.length + manualExpenses.length,
    stockMovements: movementDocs.length,
    requestsForQuote: rfqResult.requests,
    quotes: quotes.length,
    returns: rmas.length,
  };
}

/** True when nothing has been seeded yet — drives the empty-database warning on boot. */
async function isDatabaseEmpty() {
  return (await Product.estimatedDocumentCount()) === 0;
}

// CLI entry: `npm run seed`
if (process.argv[1] && process.argv[1].endsWith('run.js')) {
  (async () => {
    console.log('\n  Seeding Cellvix…\n');
    await connectDb();
    const result = await seedDatabase();
    console.log('\n  Done.', result);
    console.log(`\n  Demo logins (password: ${DEMO_PASSWORD})`);
    console.log('    buyer@cellvix.ca    approved buyer, Net 30, order history');
    console.log('    pending@cellvix.ca  pending approval');
    console.log('    admin@cellvix.ca    admin');
    // The portal is a separate session against a separate collection (§6.8a),
    // so its logins are listed apart — reading them as a fourth kind of user
    // account is exactly the confusion the split exists to prevent.
    console.log(`\n  Supplier portal at /supplier (same password)`);
    console.log('    orders@northbridgeparts.example     quoted most, won one');
    console.log('    sales@kaiyuan-components.example    the best complete quote');
    console.log('    hello@pacificcell.example           batteries and charging ports');
    console.log('    procurement@atlasoem.example        declined one request');
    console.log('    sales@rivettools.example            deactivated — cannot sign in\n');
    await disconnectDb();
    await mongoose.connection.close();
    process.exit(0);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { seedDatabase, isDatabaseEmpty };
