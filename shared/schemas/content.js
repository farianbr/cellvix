import { z } from 'zod';

/**
 * Editorial content: blog posts, FAQs and offers.
 *
 * All three are admin-authored and publicly read, so the same file serves the
 * admin forms (client) and the `validate()` middleware (server). Money is
 * integer cents here as everywhere else (PROJECT_INSTRUCTIONS.md §5.8).
 */

const cents = z.coerce.number().int().min(0).max(100_000_000);
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid account id.');
const optionalDate = z.string().trim().optional().nullable().or(z.literal(''));

// --- blog --------------------------------------------------------------------

export const BLOG_CATEGORIES = [
  { value: 'repair-guides', label: 'Repair guides' },
  { value: 'industry-news', label: 'Industry news' },
  { value: 'product-updates', label: 'Product updates' },
  { value: 'business-tips', label: 'Business tips' },
];

export const BLOG_STATUSES = ['draft', 'published'];

export const blogPostSchema = z.object({
  title: z.string().trim().min(4, 'Give the post a title.').max(160),
  excerpt: z.string().trim().min(10, 'Write a one-line summary.').max(320),
  // Plain text with a tiny markup vocabulary — see client/src/lib/richText.jsx.
  // Never HTML: the renderer builds React nodes, so there is nothing to inject.
  body: z.string().trim().min(40, 'The post needs a body.').max(40_000),
  category: z.enum(BLOG_CATEGORIES.map((c) => c.value)),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  coverImage: z.string().trim().max(500).optional().or(z.literal('')),
  authorName: z.string().trim().min(2, 'Who wrote it?').max(80),
  authorRole: z.string().trim().max(80).optional().or(z.literal('')),
  status: z.enum(BLOG_STATUSES).default('draft'),
  publishedAt: optionalDate,
  isFeatured: z.boolean().default(false),
});

// --- faq ---------------------------------------------------------------------

export const FAQ_CATEGORIES = [
  { value: 'ordering', label: 'Ordering' },
  { value: 'accounts', label: 'Accounts & approval' },
  { value: 'pricing', label: 'Pricing & credit' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'returns', label: 'Returns & warranty' },
  { value: 'products', label: 'Parts & grading' },
];

export const FAQ_SCOPES = [
  { value: 'general', label: 'General — FAQ page' },
  { value: 'product', label: 'Product — product detail pages' },
];

/**
 * A product-scoped FAQ with no `partType` and no `deviceTypeSlug` applies to
 * every product. Filling either one narrows it; that is how "every product
 * detail page has an FAQ" holds without authoring 420 of them.
 */
export const faqSchema = z.object({
  question: z.string().trim().min(6, 'Enter the question.').max(240),
  answer: z.string().trim().min(10, 'Enter the answer.').max(4000),
  category: z.enum(FAQ_CATEGORIES.map((c) => c.value)).default('ordering'),
  scope: z.enum(['general', 'product']).default('general'),
  partType: z.string().trim().max(60).optional().or(z.literal('')),
  deviceTypeSlug: z.string().trim().max(60).optional().or(z.literal('')),
  order: z.coerce.number().int().min(0).max(999).default(0),
  isPublished: z.boolean().default(true),
});

// --- offers ------------------------------------------------------------------

export const OFFER_KINDS = [
  { value: 'deal', label: 'Deal — a discount across a slice of the catalogue' },
  { value: 'combo', label: 'Combo — a fixed bundle of SKUs at a bundle price' },
];

export const DISCOUNT_TYPES = [
  { value: 'percent', label: '% off' },
  { value: 'amount', label: '$ off' },
  { value: 'free-shipping', label: 'Free shipping' },
];

export const OFFER_ACCENTS = ['brand', 'ok', 'info', 'warn'];

export const offerSchema = z
  .object({
    title: z.string().trim().min(4, 'Give the offer a title.').max(120),
    subtitle: z.string().trim().max(200).optional().or(z.literal('')),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    terms: z.string().trim().max(1000).optional().or(z.literal('')),
    kind: z.enum(['deal', 'combo']).default('deal'),
    badge: z.string().trim().max(30).optional().or(z.literal('')),
    accent: z.enum(OFFER_ACCENTS).default('brand'),
    code: z.string().trim().max(24).optional().or(z.literal('')),

    // deal
    discountType: z.enum(['percent', 'amount', 'free-shipping']).default('percent'),
    discountPercent: z.coerce.number().int().min(0).max(90).default(0),
    discountAmount: cents.default(0),
    minQty: z.coerce.number().int().min(0).max(9999).default(0),
    minSpend: cents.default(0),
    target: z
      .object({
        deviceTypeSlug: z.string().trim().max(60).optional().or(z.literal('')),
        brandSlug: z.string().trim().max(60).optional().or(z.literal('')),
        partType: z.string().trim().max(60).optional().or(z.literal('')),
        grade: z.string().trim().max(20).optional().or(z.literal('')),
      })
      .default({}),

    // combo
    items: z
      .array(
        z.object({
          sku: z.string().trim().min(2).max(40),
          qty: z.coerce.number().int().min(1).max(999).default(1),
        }),
      )
      .max(20)
      .default([]),
    bundlePrice: cents.default(0),

    // who may redeem, and how often
    redemption: z.enum(['multi', 'single']).default('multi'),
    usageLimit: z.coerce.number().int().min(0).max(1_000_000).default(0),
    eligibility: z.enum(['all', 'accounts']).default('all'),
    allowedUsers: z.array(objectId).max(500).default([]),

    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    order: z.coerce.number().int().min(0).max(999).default(0),
  })
  .superRefine((value, ctx) => {
    // A combo with no SKUs is an empty page section, and a combo with no bundle
    // price has no offer in it — both are worth refusing at the boundary rather
    // than rendering as a broken card.
    if (value.kind === 'combo') {
      if (value.items.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items'],
          message: 'A combo needs at least two SKUs.',
        });
      }
      if (value.bundlePrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bundlePrice'],
          message: 'Enter the bundle price.',
        });
      }
    }

    // An account-restricted offer with nobody on the list is a dead offer that
    // looks live in the admin table — refuse it where it is still cheap to fix.
    if (value.eligibility === 'accounts' && value.allowedUsers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowedUsers'],
        message: 'Pick at least one account, or open the offer to everyone.',
      });
    }

    // Single-use is per account, so it needs an account to be per. An offer
    // with no code cannot be single-use: it applies automatically to whoever
    // qualifies, which is the opposite of a one-shot redemption.
    if (value.redemption === 'single' && !value.code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['redemption'],
        message: 'Single-use needs a promo code — an automatic offer cannot be redeemed once.',
      });
    }

    if (value.kind === 'deal') {
      if (value.discountType === 'percent' && value.discountPercent <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discountPercent'],
          message: 'Enter a percentage.',
        });
      }
      if (value.discountType === 'amount' && value.discountAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discountAmount'],
          message: 'Enter an amount.',
        });
      }
    }
  });
