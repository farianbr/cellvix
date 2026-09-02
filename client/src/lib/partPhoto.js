import { partPhoto } from '@shared/partPhotos.js';

/**
 * A product's picture.
 *
 * The brand-and-component-type photo map moved to `shared/partPhotos.js`: the
 * catalogue hides products that have no picture, and that filter is applied
 * server-side so the result count matches the grid. Both sides read one map.
 */
export { partPhoto };

/**
 * `product.image` first, then the brand stock photo. Null means the caller
 * should draw `PartIllustration` instead — which, for a catalogue product,
 * should not happen: the server does not list products without a photo.
 */
export function productPhoto(product) {
  return product?.image || partPhoto(product);
}

export default productPhoto;
