import { TAXONOMY, PART_TYPES, GRADE_MULTIPLIER } from './taxonomy.data.js';

/**
 * Deterministic pseudo-random generator.
 *
 * The seed catalogue must be identical on every run: screenshots, demo order
 * history and facet counts all have to line up between sessions. Math.random()
 * would make every reseed a different store.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Flattens the nested TAXONOMY literal into Taxonomy documents. */
export function buildTaxonomyDocs() {
  const docs = [];
  let order = 0;

  for (const deviceType of TAXONOMY) {
    docs.push({
      kind: 'deviceType',
      name: deviceType.name,
      slug: deviceType.slug,
      parentSlug: null,
      icon: deviceType.icon,
      isFeatured: Boolean(deviceType.featured),
      order: order++,
      path: { deviceType: deviceType.slug },
    });

    let brandOrder = 0;
    for (const brand of deviceType.brands) {
      docs.push({
        kind: 'brand',
        name: brand.name,
        slug: brand.slug,
        parentSlug: deviceType.slug,
        isFeatured: Boolean(brand.featured),
        order: brandOrder++,
        path: { deviceType: deviceType.slug, brand: brand.slug },
      });

      let seriesOrder = 0;
      for (const series of brand.series) {
        docs.push({
          kind: 'series',
          name: series.name,
          slug: series.slug,
          parentSlug: brand.slug,
          order: seriesOrder++,
          path: { deviceType: deviceType.slug, brand: brand.slug, series: series.slug },
        });

        let modelOrder = 0;
        for (const modelName of series.models) {
          const modelSlug = slugify(`${brand.slug}-${modelName}`);
          docs.push({
            kind: 'model',
            name: modelName,
            slug: modelSlug,
            parentSlug: series.slug,
            order: modelOrder++,
            path: {
              deviceType: deviceType.slug,
              brand: brand.slug,
              series: series.slug,
              model: modelSlug,
            },
          });
        }
      }
    }
  }

  return docs;
}

const COLOUR_VARIANTS = ['Black', 'White', 'Space Grey', 'Blue', 'Graphite'];

/**
 * Rival wholesalers the catalogue benchmarks against.
 *
 * INVENTED NAMES, on purpose. These are placeholders standing in for a real
 * price feed, and seeding a real distributor's name against a number we made up
 * would be putting words in a named company's mouth — it reads as a factual
 * claim about their pricing the moment it renders on a card.
 */
const COMPETITORS = ['Northbound Parts', 'MapleCell Supply', 'PartsDirect CA'];

/**
 * A stable 32-bit seed from a string, so a product that has no sequence number
 * — anything already in a live database, reached by the backfill rather than by
 * the generator — can still be given the same benchmarks on every run.
 */
function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Benchmark prices for one product.
 *
 * Two or three rivals, each 6–34% above our price, so the "save X vs market"
 * line has something to say on most cards. About one product in nine gets a
 * rival that UNDERCUTS us: the serializer drops the claim when we are not
 * actually cheaper, and a seed where we always win never exercises that branch.
 *
 * Takes its OWN generator, seeded per product from the sequence number, rather
 * than drawing from the catalogue's shared `random()`. Sharing it would advance
 * that stream by four extra calls per product, which changes every price and
 * stock roll after this one — the catalogue is meant to be byte-identical on
 * every reseed, and adding a field here must not silently redraw the store.
 */
export function buildCompetitors(price, seed) {
  const random = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
  const pool = [...COMPETITORS].sort(() => random() - 0.5);
  const count = random() < 0.55 ? 3 : 2;
  const undercut = random() < 0.11;

  return pool.slice(0, count).map((name, index) => {
    // Round to the same nearest-5 the catalogue prices use, so a comparison row
    // never looks more precise than the number it sits beside.
    const factor = undercut && index === 0 ? 0.88 + random() * 0.08 : 1.06 + random() * 0.28;
    return { name, price: Math.round((price * factor) / 5) * 5 };
  });
}

/**
 * Builds the product catalogue.
 *
 * Not every model gets every part type — that would be a uniform grid with no
 * interesting empty states. The generator picks a deterministic subset so facet
 * counts vary the way a real catalogue does, and so "no results" is reachable.
 */
export function buildProducts({ targetCount = 420 } = {}) {
  const random = mulberry32(20260819);
  const products = [];
  const models = [];

  for (const deviceType of TAXONOMY) {
    for (const brand of deviceType.brands) {
      for (const series of brand.series) {
        for (const modelName of series.models) {
          models.push({
            deviceTypeSlug: deviceType.slug,
            deviceTypeName: deviceType.name,
            brandSlug: brand.slug,
            brandName: brand.name,
            seriesSlug: series.slug,
            seriesName: series.name,
            modelSlug: slugify(`${brand.slug}-${modelName}`),
            modelName,
          });
        }
      }
    }
  }

  // How premium a model is — drives price within each part's band.
  const premiumHint = (name) =>
    /ultra|pro max|pro|max|fold|plus|16|15/i.test(name) ? 0.72 + random() * 0.28 : random() * 0.7;

  let sequence = 1000;

  for (const model of models) {
    const parts = PART_TYPES[model.deviceTypeSlug] ?? PART_TYPES.smartphone;
    const premium = premiumHint(model.modelName);

    // 45–100% of the available part types for this model.
    const partCount = Math.max(2, Math.round(parts.length * (0.45 + random() * 0.55)));
    const chosenParts = [...parts].sort(() => random() - 0.5).slice(0, partCount);

    for (const part of chosenParts) {
      // 1–2 grades per part, drawn from the grades that part actually ships in.
      const gradePool = [...part.grades].sort(() => random() - 0.5);
      const gradeCount = random() < 0.42 ? 2 : 1;

      for (const grade of gradePool.slice(0, gradeCount)) {
        const [low, high] = part.price;
        const base = low + (high - low) * premium;
        const price = Math.round((base * GRADE_MULTIPLIER[grade] * (0.94 + random() * 0.12)) / 5) * 5;

        // Deliberate spread so the < 50 units rule has plenty of both sides.
        const roll = random();
        let stock;
        if (roll < 0.14) stock = 0;
        else if (roll < 0.46) stock = 1 + Math.floor(random() * 48);
        else if (roll < 0.8) stock = 50 + Math.floor(random() * 180);
        else stock = 230 + Math.floor(random() * 900);


        sequence += 1;
        const sku = `CVX-${model.brandSlug.slice(0, 3).toUpperCase()}-${part.slug
          .split('-')
          .map((s) => s[0])
          .join('')
          .toUpperCase()}-${sequence}`;

        const name = `${model.modelName} ${part.label}`;
        const slug = slugify(`${model.modelSlug}-${part.slug}-${grade}-${sequence}`);

        products.push({
          sku,
          name,
          slug,
          description: `Replacement ${part.label.toLowerCase()} for the ${model.modelName}. ${
            grade === 'NEW'
              ? 'Brand new stock, individually tested before dispatch.'
              : grade === 'OEM'
                ? 'Genuine OEM part, service-pack condition.'
                : grade.startsWith('PULL')
                  ? `Tested pull, grade ${grade.slice(-1)} cosmetic condition.`
                  : 'Aftermarket equivalent, quality-checked to Cellvix spec.'
          } Ships from our Canadian warehouse.`,
          partType: part.slug,
          partTypeLabel: part.label,
          grade,
          price,
          compareAtPrice: random() < 0.22 ? Math.round((price * 1.18) / 5) * 5 : undefined,
          competitors: buildCompetitors(price, sequence),
          stock,
          deviceTypeSlug: model.deviceTypeSlug,
          deviceTypeName: model.deviceTypeName,
          brandSlug: model.brandSlug,
          brandName: model.brandName,
          seriesSlug: model.seriesSlug,
          seriesName: model.seriesName,
          modelSlug: model.modelSlug,
          modelName: model.modelName,
          specs: {
            Condition: grade,
            Compatibility: model.modelName,
            Colour: COLOUR_VARIANTS[Math.floor(random() * COLOUR_VARIANTS.length)],
            Warranty: grade === 'NEW' || grade === 'OEM' ? '90 days' : '30 days',
            Origin: 'Canada',
          },
          searchTerms: [
            model.modelName,
            model.brandName,
            model.seriesName,
            part.label,
            part.slug.replace(/-/g, ' '),
            grade,
            sku,
          ],
          isActive: true,
        });
      }
    }
  }

  // Trim deterministically to roughly the target size, keeping the spread even.
  if (products.length > targetCount) {
    const step = products.length / targetCount;
    const trimmed = [];
    for (let i = 0; trimmed.length < targetCount && Math.floor(i * step) < products.length; i += 1) {
      trimmed.push(products[Math.floor(i * step)]);
    }
    return trimmed;
  }

  return products;
}
