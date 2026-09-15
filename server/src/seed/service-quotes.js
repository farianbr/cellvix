import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../config/db.js';
import { db, dbFor } from '../db/models.js';
import { runInBusiness } from '../db/context.js';
import '../models/ServiceQuote.js';
import '../models/Service.js';
import '../models/DeviceCatalog.js';
import '../models/User.js';
import '../models/Business.js';
import { priceQuote } from '../services/serviceQuoteService.js';
import { displayNameOf } from '../utils/displayName.js';

/**
 * Demo repair estimates, one per status (Sales § Quote).
 *
 * **Built from the shop's OWN catalogues, not from hardcoded strings.** Every
 * service line is looked up in `Service` and every device in `DeviceCatalog`, so
 * a seeded estimate is one the staff member could have built through the form -
 * same names, same prices, same `service` references. Inventing line text here
 * would produce estimates that look right and that no report could group,
 * which is the failure mode a demo dataset exists to avoid.
 *
 * **Totals are computed by `priceQuote`**, the same function the service uses.
 * Writing figures by hand would let the seed drift from the rule that every
 * total is recomputed server-side, and the first person to notice would be
 * whoever opened one and found the arithmetic wrong.
 *
 * Additive, and skips a business that already has estimates - re-running adds
 * nothing rather than a second set.
 */

/**
 * The seven estimates, as intent rather than as data.
 *
 * `services` names rows in the catalogue; if one is missing the line is dropped
 * rather than invented, and an estimate left with no lines is skipped. That is
 * the honest failure: a seed that silently makes up a service is a seed whose
 * output cannot be trusted to mean anything.
 */
const ESTIMATES = [
  {
    key: 'draft-screen',
    status: 'draft',
    serviceType: 'walk_in',
    source: 'phone',
    daysAgo: 1,
    validDays: 14,
    device: { category: 'Phone', brand: 'Apple', series: 'iPhone 15', model: 'iPhone 15 Pro Max' },
    problem: 'Dropped face down, glass cracked across the top third. Touch still works.',
    services: ['Screen replacement'],
    clientNotes: 'Quoted over the phone. Customer is checking whether it is worth repairing.',
    internalNotes: 'Screen stock is low, check before committing to a same-day turnaround.',
    taxRate: 5,
    province: 'AB',
  },
  {
    key: 'sent-battery',
    status: 'sent',
    serviceType: 'walk_in',
    source: 'counter',
    daysAgo: 4,
    validDays: 14,
    device: { category: 'Phone', brand: 'Samsung', series: 'Galaxy S', model: 'Galaxy S23' },
    problem: 'Battery drains from full to flat in about four hours.',
    services: ['Battery replacement', 'Diagnostic assessment'],
    clientNotes: 'Includes a free diagnostic. Ninety days on the battery.',
    taxRate: 5,
    province: 'AB',
  },
  {
    key: 'sent-laptop',
    status: 'sent',
    serviceType: 'pickup',
    source: 'web',
    daysAgo: 6,
    validDays: 21,
    device: { category: 'Laptop', brand: 'Apple', series: 'MacBook Pro', model: 'MacBook Pro 14" (M3)' },
    problem: 'Spilled coffee across the keyboard. Powers on but several keys are dead.',
    services: ['Liquid damage treatment', 'Keyboard replacement'],
    clientNotes:
      'Liquid damage carries no warranty - corrosion can continue after the repair. We will call before doing anything beyond this quote.',
    technicianNotes: 'Open and inspect the board before ordering the keyboard.',
    // The one that justifies the field existing: a door-step collection from
    // outside the standard area.
    extendedServiceFee: true,
    extendedServiceFeeDollars: 25,
    taxRate: 5,
    province: 'AB',
  },
  {
    key: 'accepted-tablet',
    status: 'accepted',
    serviceType: 'walk_in',
    source: 'counter',
    daysAgo: 3,
    validDays: 14,
    device: { category: 'Tablet', brand: 'Apple', series: 'iPad', model: 'iPad Air (5th gen)' },
    problem: 'Cracked screen, corner shattered. Customer wants it back before the weekend.',
    services: ['Screen replacement (tablet)'],
    clientNotes: 'Accepted on the phone. Customer bringing it in tomorrow morning.',
    taxRate: 5,
    province: 'AB',
  },
  {
    key: 'accepted-console',
    status: 'accepted',
    serviceType: 'walk_in',
    source: 'counter',
    daysAgo: 2,
    validDays: 14,
    device: { category: 'Console', brand: 'Sony', series: 'PlayStation', model: 'PlayStation 5' },
    problem: 'Controller sticks drift left on both sticks. Console also runs hot and loud.',
    services: ['Joystick drift repair', 'Thermal paste and clean'],
    discountDollars: 15,
    discountCode: 'REPEAT15',
    clientNotes: 'Repeat customer discount applied.',
    taxRate: 5,
    province: 'AB',
  },
  {
    key: 'rejected-data',
    status: 'rejected',
    serviceType: 'walk_in',
    source: 'phone',
    daysAgo: 12,
    validDays: 14,
    device: { category: 'Phone', brand: 'Google', series: 'Pixel', model: 'Pixel 7' },
    problem: 'Will not power on at all. Customer wants the photos off it.',
    services: ['Data recovery'],
    clientNotes: 'Quoted for recovery only, no repair.',
    internalNotes: 'Customer said it was more than the phone is worth. Left it with us to recycle.',
    taxRate: 5,
    province: 'AB',
  },
  {
    /**
     * Dated far enough back that `validUntil` has passed, because `expired` is
     * **derived** rather than stored - the list computes it from the date, so a
     * seeded row with `status: 'expired'` would be a state the code never
     * produces. This one is stored as `sent` and reads as expired, exactly as a
     * real one does.
     */
    key: 'expired-watch',
    status: 'sent',
    serviceType: 'walk_in',
    source: 'counter',
    daysAgo: 45,
    validDays: 14,
    device: { category: 'Watch', brand: 'Apple', series: 'Apple Watch', model: 'Apple Watch Series 9' },
    problem: 'Screen lifting away from the case at the top edge.',
    services: ['Battery replacement', 'Diagnostic assessment'],
    clientNotes: 'Swollen battery is the likely cause. Quote held for two weeks.',
    taxRate: 5,
    province: 'AB',
  },
];

function daysBack(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(11, 0, 0, 0);
  return date;
}

async function nextQuoteNumber(sequence) {
  const year = new Date().getFullYear();
  return `EST-${year}-${String(sequence).padStart(5, '0')}`;
}

async function seedServiceQuotes({ quiet = false, business = null } = {}) {
  const log = quiet ? () => {} : (...args) => console.log(...args);

  const already = await db().ServiceQuote.countDocuments({});
  if (already > 0) {
    log(`    estimates: ${already} already present, skipped`);
    return { added: 0, existing: already };
  }

  const customers = await db()
    .User.find({ role: 'buyer' })
    .select('contactName businessName email phone')
    .limit(20)
    .lean();

  if (!customers.length) {
    log('    estimates: no customers in this business, skipped');
    return { added: 0, existing: 0 };
  }

  // The real catalogue, keyed by name - the same lookup the form's picker does.
  const services = await db().Service.find({}).select('name priceCents').lean();
  const byName = new Map(services.map((service) => [service.name, service]));

  if (!byName.size) {
    log('    estimates: no services in this business, skipped (run seed:service-business first)');
    return { added: 0, existing: 0 };
  }

  const docs = [];
  let sequence = 1;

  for (const [index, spec] of ESTIMATES.entries()) {
    const lines = spec.services
      .map((name) => byName.get(name))
      .filter(Boolean)
      .map((service) => ({
        name: service.name,
        priceCents: service.priceCents,
        qty: 1,
        // The reference, so a report can group by what was actually quoted.
        service: service._id,
      }));

    // A missing service means the catalogue changed under us. Dropping the
    // estimate is honest; inventing the line is not.
    if (!lines.length) continue;

    const customer = customers[index % customers.length];
    const quoteDate = daysBack(spec.daysAgo);
    const validUntil = new Date(quoteDate);
    validUntil.setDate(validUntil.getDate() + spec.validDays);

    const devices = [
      {
        category: spec.device.category,
        brand: spec.device.brand,
        series: spec.device.series,
        model: spec.device.model,
        problem: spec.problem,
        services: lines,
        parts: [],
      },
    ];

    const feeCents = spec.extendedServiceFee
      ? Math.round((spec.extendedServiceFeeDollars ?? 0) * 100)
      : 0;
    const discountCents = Math.round((spec.discountDollars ?? 0) * 100);

    // The same function the service uses, so the seed cannot drift from the
    // rule that a total is computed rather than stated.
    const totals = priceQuote(devices, {
      discountCents,
      taxRate: spec.taxRate ?? 0,
      feeCents,
    });

    const timeline = [
      { status: 'draft', at: quoteDate, note: 'Estimate created.' },
    ];
    if (spec.status !== 'draft') {
      const sentAt = new Date(quoteDate);
      sentAt.setHours(sentAt.getHours() + 2);
      timeline.push({ status: 'sent', at: sentAt, note: 'Sent to the customer.' });
    }
    if (['accepted', 'rejected'].includes(spec.status)) {
      const answeredAt = new Date(quoteDate);
      answeredAt.setDate(answeredAt.getDate() + 1);
      timeline.push({
        status: spec.status,
        at: answeredAt,
        note: spec.status === 'accepted' ? 'Customer accepted.' : 'Customer declined.',
      });
    }

    docs.push({
      quoteNumber: await nextQuoteNumber(sequence++),
      user: customer._id,
      customerName: displayNameOf(customer),
      customerPhone: customer.phone ?? '',
      customerEmail: customer.email ?? '',
      business,

      source: spec.source,
      status: spec.status,
      serviceType: spec.serviceType,
      quoteDate,
      validUntil,

      devices,

      clientNotes: spec.clientNotes,
      technicianNotes: spec.technicianNotes,
      internalNotes: spec.internalNotes,

      discountCents,
      discountCode: spec.discountCode,
      extendedServiceFee: Boolean(spec.extendedServiceFee),
      extendedServiceFeeCents: feeCents,
      taxRate: spec.taxRate ?? 0,
      taxCents: totals.taxCents,
      province: spec.province,
      subtotalCents: totals.subtotal,
      totalCents: totals.total,

      timeline,
      createdAt: quoteDate,
      updatedAt: quoteDate,
    });
  }

  if (docs.length) await db().ServiceQuote.insertMany(docs);

  log(`    estimates: ${docs.length} added`);
  return { added: docs.length, existing: 0 };
}

// CLI entry: `npm run seed:service-quotes`
if (process.argv[1] && process.argv[1].endsWith('service-quotes.js')) {
  (async () => {
    console.log('\n  Seeding repair estimates…\n');
    await connectDb();

    const businesses = await db()
      .Business.find({ deletedAt: null })
      .select('name code businessType')
      .lean();

    const targets = businesses.length ? businesses : [null];

    for (const business of targets) {
      if (business && business.businessType === 'product') {
        console.log(`  ${business.name} (${business.code}) - product business, skipped`);
        continue;
      }

      if (business) console.log(`  ${business.name} (${business.code})`);
      const work = () => seedServiceQuotes({ business: business?._id ?? null });

      if (business) {
        await runInBusiness(
          {
            businessId: String(business._id),
            code: business.code,
            connection: dbFor(business.code),
          },
          work,
        );
      } else {
        await work();
      }
    }

    console.log('\n  Done.\n');
    await disconnectDb();
    await mongoose.connection.close();
    process.exit(0);
  })().catch((error) => {
    console.error('\n  Seed failed:', error.message, '\n');
    process.exit(1);
  });
}

export { seedServiceQuotes };
export default seedServiceQuotes;
