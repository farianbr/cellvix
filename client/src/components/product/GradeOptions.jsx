import ProductCard from '@/components/product/ProductCard';

/**
 * The same part, at every grade Cellvix stocks it in.
 *
 * WHY IT IS A CARD GRID and not a table of rows. It was a table first, on the
 * argument that four facts repeated down a column is what a table is for. That
 * was the wrong read of the page: a grade is a SEPARATE PRODUCT here, with its
 * own SKU, price, stock and add-to-cart, and the site already has one way of
 * presenting a product you might buy. Drawing these as rows made them look like
 * attributes of the part above rather than parts in their own right, and it
 * denied them the one control that matters, which is the button that puts one
 * in the cart.
 *
 * So it reuses `ProductCard` exactly as "More parts for the..." does, and sits
 * directly above it. The two sections then read as a pair: the same part at
 * another grade, then other parts for the same phone. Same grid, same card,
 * same spacing - the only thing that changes is the question being answered.
 *
 * The picture takes care of itself: `productPhoto` resolves a product's own
 * image first and otherwise the stock photo for its brand and component type,
 * which is grade-independent. Two grades of one part therefore show the same
 * photograph without anything here arranging it.
 */

/**
 * The quality ladder, as the rest of the site orders it.
 *
 * Imported rather than re-declared - `GRADE_ORDER` in lib/constants is what the
 * filter sidebar and the badges already use, and a second copy here would be
 * free to drift from it.
 */
import { GRADE_ORDER } from '@/lib/constants';

function gradeRank(grade) {
  const index = GRADE_ORDER.indexOf(grade);
  // An unknown grade sorts last rather than first: it is a data problem, and
  // putting it at the top of the ladder would state something false about it.
  return index === -1 ? GRADE_ORDER.length : index;
}

export function GradeOptions({ product, grades = [], className }) {
  // Nothing to offer. The section is about what ELSE this part comes as, so
  // with no sibling it has nothing to say and does not draw a heading over an
  // empty grid.
  if (!grades.length) return null;

  // ORDERED BY GRADE, not by price. `GRADE_ORDER` is the scale a buyer already
  // knows (NEW, OEM, Pull A, Pull B, aftermarket); sorting by price would
  // reshuffle that ladder whenever a pull happened to cost more than an
  // aftermarket part, and the row would stop meaning anything.
  //
  // The product being viewed is NOT in this grid. It is the thing at the top of
  // the page with its own picture, price and button; repeating it here as a
  // fifth card would be the page offering the reader what they are already
  // looking at.
  const rows = [...grades].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade));

  return (
    <section className={className} aria-labelledby="grade-options">
      <h2 id="grade-options" className="mb-4 text-xl">
        The same {product.partTypeLabel?.toLowerCase()} at another grade
      </h2>

      {/* The same grid as "More parts", so the two sections below the fold line
          up card for card rather than being two different shapes of the same
          idea. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {rows.slice(0, 4).map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}

export default GradeOptions;
