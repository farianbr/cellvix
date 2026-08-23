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
import { buildTaxonomyDocs, buildProducts } from './generate.js';
import { BLOG_POSTS, GENERAL_FAQS, PRODUCT_FAQS, buildOffers } from './content.data.js';

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
export async function seedDatabase({ quiet = false } = {}) {
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
  ]);

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
    const user = new User(data);
    await user.setPassword(DEMO_PASSWORD);
    if (data.status === 'approved') user.approvedAt = new Date(Date.now() - 90 * 86_400_000);
    users.push(await user.save());
  }
  log(`  users: ${users.length}`);

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
      payments: paid
        ? [{ amount: order.total, at: dueDate, method: 'EFT', reference: `EFT-${88_400 + index}` }]
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
  };
}

/** True when nothing has been seeded yet — drives the empty-database warning on boot. */
export async function isDatabaseEmpty() {
  return (await Product.estimatedDocumentCount()) === 0;
}

// CLI entry: `npm run seed`
if (process.argv[1] && process.argv[1].endsWith('run.js')) {
  console.log('\n  Seeding Cellvix…\n');
  await connectDb();
  const result = await seedDatabase();
  console.log('\n  Done.', result);
  console.log(`\n  Demo logins (password: ${DEMO_PASSWORD})`);
  console.log('    buyer@cellvix.ca    approved buyer, Net 30, order history');
  console.log('    pending@cellvix.ca  pending approval');
  console.log('    admin@cellvix.ca    admin\n');
  await disconnectDb();
  await mongoose.connection.close();
  process.exit(0);
}
