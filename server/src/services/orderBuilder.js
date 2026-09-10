import Order from '../models/Order.js';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Settings from '../models/Settings.js';
import ApiError from '../utils/ApiError.js';
import notificationService from './notificationService.js';
import { displayNameOf } from '../utils/displayName.js';

/**
 * Raising an order that did not come from a cart.
 *
 * Two callers reach an order without a checkout: converting an accepted quote
 * (`quoteService.convertQuote`, §6.6) and an admin raising one directly for a
 * phone or email order (`adminService.createOrder`, §7.2). They do different
 * work up front — one honours quoted prices and reports drift, the other reads
 * the catalogue — and then they do **exactly** the same thing: check the
 * account, price it, take the stock, write the order, raise the invoice, ring
 * the bell.
 *
 * That shared tail lives here rather than in either caller. It was already
 * written twice before this file existed — `nextOrderNumber` had two copies and
 * the `INV-` generator had two more, one of them inlined — and a second place
 * that raises orders is a second place to forget that ordering needs approval,
 * or that stock has to be re-checked between pricing and writing.
 *
 * **What it does not do is decide a price.** `items` arrive already priced by
 * the caller, because that is the one thing the two genuinely disagree about: a
 * quote's price is a promise the catalogue no longer governs. Everything
 * computed *from* those prices — line totals, subtotal, tax, total — is
 * recomputed here from the live tax rate, never taken on trust (invariant 8).
 */

/** Days added to the issue date to get a due date, by terms. */
const TERMS_DAYS = { prepaid: 0, net15: 15, net30: 30, net60: 60 };

/**
 * `CVX-2026-00001`. Last-row-wins rather than a counter document: a collision
 * needs two orders created in the same millisecond, and the unique index on
 * `orderNumber` is the backstop when it happens.
 */
async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const prefix = `CVX-${year}-`;
  const last = await Order.findOne({ orderNumber: new RegExp(`^${prefix}`) })
    .sort({ orderNumber: -1 })
    .select('orderNumber')
    .lean();

  const sequence = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 10_001;
  return `${prefix}${String(sequence).padStart(5, '0')}`;
}

/**
 * `INV-2026-00001`, on the same terms as the order numbering above.
 *
 * The series is a parameter because there are three of them and they must not
 * share a counter: `INV` for a settled tax invoice, `CVX` for an amount still
 * due, `RCT` for a store-credit receipt. Each keeps its own gapless run, which
 * is the whole point of renumbering a `due` record when it settles — the `INV`
 * sequence contains only invoices that were actually raised.
 */
async function nextInvoiceNumber(series = 'INV') {
  const year = new Date().getFullYear();
  const prefix = `${series}-${year}-`;
  const last = await Invoice.findOne({ number: new RegExp(`^${prefix}`) })
    .sort({ number: -1 })
    .select('number')
    .lean();

  const sequence = last ? Number(last.number.slice(prefix.length)) + 1 : 10_001;
  return `${prefix}${String(sequence).padStart(5, '0')}`;
}

/** The buyer's default shipping province, for the tax rate. ON if none is set. */
function provinceFor(user) {
  const preferred = (user.addresses ?? []).find((address) => address.isDefaultShipping);
  return preferred?.region ?? user.addresses?.[0]?.region ?? user.region ?? 'ON';
}

/**
 * Turns `{ product, qty, unitPrice }` into order lines, priced from the
 * catalogue.
 *
 * `unitPrice` of zero means "use the catalogue price" — the convention
 * `quoteItemSchema` documents and `adminOrderSchema` inherits. A non-zero value
 * is an admin overriding it deliberately, which is allowed on an order raised
 * by hand for the same reason it is allowed on a quote: the negotiation
 * happened somewhere this system was not.
 */
async function buildOrderItems(rawItems) {
  const ids = rawItems.map((item) => item.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: ids } })
    .select('sku name slug price cost stock grade partType partTypeLabel brandSlug images')
    .lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  return rawItems.map((item) => {
    const product = byId.get(String(item.product));
    if (!product) {
      throw ApiError.badRequest('One of those products no longer exists.', 'PRODUCT_NOT_FOUND');
    }

    const unitPrice = item.unitPrice > 0 ? item.unitPrice : product.price;

    return {
      product: product._id,
      sku: product.sku,
      name: product.name,
      // Denormalised so the buyer's order page keeps reading the same after a
      // product is renamed or delisted — the same fields checkout copies.
      slug: product.slug,
      image: product.images?.[0],
      grade: product.grade,
      partType: product.partType,
      partTypeLabel: product.partTypeLabel,
      brandSlug: product.brandSlug ?? undefined,
      qty: item.qty,
      unitPrice,
      lineTotal: item.qty * unitPrice,
      unitCost: product.cost > 0 ? product.cost : undefined,
    };
  });
}

/**
 * The billing record an order raises, on the account's own terms.
 *
 * Kept beside `raiseOrder` rather than inside it, because `createInvoice`
 * (a standalone invoice, §7.2) needs the numbering and the due-date arithmetic
 * without an order to hang them on.
 *
 * Nothing settled here, so this is always a `due` record in the `CVX-` series,
 * never an invoice. It becomes one — renumbered into `INV-` — when it is paid
 * in full, and `services/invoicePaymentService.js` is the only thing that does
 * that.
 */
async function createInvoiceFor(order, terms) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (TERMS_DAYS[terms] ?? 0));

  return Invoice.create({
    number: await nextInvoiceNumber('CVX'),
    kind: 'due',
    order: order._id,
    user: order.user,
    amount: order.total,
    amountPaid: 0,
    issuedAt: new Date(),
    dueDate,
    terms,
    status: 'unpaid',
  });
}

/**
 * Writes the order, takes the stock and raises the invoice.
 *
 * `user` is a full account document or lean object — the caller has already
 * loaded it, and re-reading it here would let the two paths disagree about
 * which account they are billing.
 *
 * Every rule checkout enforces is enforced here too, and for the same reasons:
 *
 * - **Ordering needs approval.** A quote conversion does not get to bypass the
 *   gate every other order goes through, and neither does an admin raising one
 *   by hand — a pending business is pending because nobody has decided to
 *   extend it credit yet.
 * - **A shipping address has to exist**, because an order that cannot be sent
 *   anywhere is a record of a promise nobody can keep.
 * - **Stock is re-checked immediately before the decrement**, not when the
 *   lines were priced. Between those two moments a checkout can empty the
 *   shelf.
 *
 * Stock moves with a single `bulkWrite` and writes no `StockMovement`, matching
 * checkout. That leaves the sales side outside the `applyStockMovement` ledger
 * the purchase side uses — a real inconsistency, but a pre-existing one, and
 * making this one path behave differently from checkout on the same product
 * would be worse than the uniform gap.
 */
async function raiseOrder({
  user,
  items,
  shipping = 0,
  deliveryCode = 'ground',
  note,
  poNumber,
  business = null,
}) {
  if (!user) throw ApiError.badRequest('That client no longer exists.', 'USER_NOT_FOUND');

  if (user.status !== 'approved') {
    throw ApiError.badRequest(
      `${displayNameOf(user)} is not approved to order yet.`,
      'USER_NOT_APPROVED',
    );
  }

  const address =
    (user.addresses ?? []).find((row) => row.isDefaultShipping) ?? user.addresses?.[0];
  if (!address) {
    throw ApiError.badRequest(
      `${displayNameOf(user)} has no shipping address on file.`,
      'NO_SHIPPING_ADDRESS',
    );
  }

  // Demand is summed per product before the check: two lines can name the same
  // SKU, and checking them one at a time would pass a pair that together take
  // the shelf below zero.
  const demand = new Map();
  for (const item of items) {
    const id = String(item.product);
    demand.set(id, (demand.get(id) ?? 0) + item.qty);
  }

  const live = await Product.find({ _id: { $in: [...demand.keys()] } })
    .select('sku name stock')
    .lean();

  for (const product of live) {
    const wanted = demand.get(product._id.toString()) ?? 0;
    if (product.stock < wanted) {
      throw ApiError.conflict(
        `${product.sku} has ${product.stock} on hand — that order needs ${wanted}.`,
        'INSUFFICIENT_STOCK',
      );
    }
  }

  const settings = await Settings.load();
  const rate = Settings.rateFor(settings, provinceFor(user));

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = Math.round((subtotal + shipping) * rate);
  const total = subtotal + shipping + tax;

  const orderNumber = await nextOrderNumber();
  const terms = user.terms ?? 'prepaid';

  const snapshot = {
    contactName: address.contactName,
    company: address.company,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postal: address.postal,
    country: address.country,
    phone: address.phone,
  };

  const order = await Order.create({
    orderNumber,
    user: user._id,
    // The shop that fulfils this order. Null on a storefront checkout, which
    // belongs to the business rather than to a counter.
    business,
    items,
    subtotal,
    discount: 0,
    shipping,
    tax,
    total,
    status: 'placed',
    poNumber,
    timeline: [{ status: 'placed', at: new Date(), note: note ?? 'Order placed.' }],
    shippingAddress: snapshot,
    billingAddress: snapshot,
    deliveryMethod: { code: deliveryCode, label: 'Ground', cost: shipping, etaDays: 3 },
    payment: {
      // Neither path has a card in the room: a converted quote and an
      // admin-raised order are both billed on the account's terms.
      method: terms === 'prepaid' ? 'card' : 'terms',
      status: 'pending',
    },
  });

  // One bulk write so a partial failure cannot half-apply, exactly as order
  // placement does it.
  await Product.bulkWrite(
    [...demand.entries()].map(([id, qty]) => ({
      updateOne: { filter: { _id: id }, update: { $inc: { stock: -qty } } },
    })),
  );

  const invoice = await createInvoiceFor(order, terms);

  await notificationService.emit({
    type: 'new_order',
    severity: 'success',
    title: `Order ${orderNumber} placed`,
    detail: `${displayNameOf(user)} · ${formatCad(total)}`,
    entity: { kind: 'order', id: orderNumber, label: orderNumber },
    href: `/admin/orders/${orderNumber}`,
  });

  return { order, invoice };
}

/** Cents to `$1,234.56`. Canadian conventions, same as everywhere else. */
function formatCad(value) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    (value ?? 0) / 100,
  );
}

export default {
  TERMS_DAYS,
  nextOrderNumber,
  nextInvoiceNumber,
  provinceFor,
  buildOrderItems,
  createInvoiceFor,
  raiseOrder,
};

export { TERMS_DAYS, nextOrderNumber, nextInvoiceNumber, provinceFor, buildOrderItems, createInvoiceFor, raiseOrder };
