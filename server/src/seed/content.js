import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db.js';
import Product from '../models/Product.js';
import BlogPost from '../models/BlogPost.js';
import Faq from '../models/Faq.js';
import Offer from '../models/Offer.js';
import { BLOG_POSTS, GENERAL_FAQS, PRODUCT_FAQS, buildOffers } from './content.data.js';

/**
 * Seeds ONLY the editorial collections — blog posts, FAQs and offers.
 *
 * `npm run seed` wipes the whole database, which is the wrong tool once a
 * database has real accounts and order history in it. This one touches three
 * collections and nothing else, so the editorial content can be refreshed on a
 * working database without costing anyone their cart.
 *
 * Offers are built from the catalogue that is already there, so the SKUs in a
 * combo always exist — the same check `offerService` enforces on every write.
 */
const readMinutes = (body) =>
  Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 220));

async function seedContent({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...args) => console.log(...args);

  const products = await Product.find({ isActive: true }).lean();
  if (products.length === 0) {
    throw new Error('No products in this database — run `npm run seed` first.');
  }

  await Promise.all([BlogPost.deleteMany({}), Faq.deleteMany({}), Offer.deleteMany({})]);

  const posts = await BlogPost.insertMany(
    BLOG_POSTS.map((post) => ({ ...post, readMinutes: readMinutes(post.body) })),
  );
  log(`  blog posts: ${posts.length}`);

  const faqs = await Faq.insertMany([
    ...GENERAL_FAQS.map((faq) => ({ ...faq, scope: 'general', isPublished: true })),
    ...PRODUCT_FAQS.map((faq) => ({ ...faq, scope: 'product', isPublished: true })),
  ]);
  log(`  faqs: ${faqs.length}`);

  const offers = await Offer.insertMany(buildOffers(products));
  log(`  offers: ${offers.length}`);

  return { posts: posts.length, faqs: faqs.length, offers: offers.length };
}

// CLI entry: `npm run seed:content`
if (process.argv[1] && process.argv[1].endsWith('content.js')) {
  (async () => {
    console.log('\n  Seeding Cellvix editorial content…\n');
    await connectDb();
    const result = await seedContent();
    console.log('\n  Done.', result, '\n');
    await disconnectDb();
    await mongoose.connection.close();
    process.exit(0);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { seedContent };
