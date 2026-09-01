/**
 * Stock photography for a part, chosen by brand + part type.
 *
 * Cellvix has not shot the catalogue (PROGRESS.md open question #6). What it
 * has is one representative photo per brand-and-part-type pair — an iPhone
 * screen, a Pixel charging port — which stands in for every model of that pair.
 * A product's own `product.image` always wins; this is the layer under it, and
 * `PartIllustration` is the layer under that when no photo exists either.
 *
 * The files live in client/public, so they are served from our own origin and
 * there is no CDN in the path. Their names carry the mapping — "iPhone
 * Screen.png" is the screen photo for every iPhone — so adding a photo is
 * dropping a file in that folder and adding one line to PHOTOS below.
 */

const DIR = '/Cellvix Demo Product Images';

/**
 * `${brand key} ${part key}` -> filename.
 *
 * The brand key is the FAMILY, not the brandSlug: `apple` and `apple-tablet`
 * are different slugs for one manufacturer, and an iPad screen is not an iPhone
 * screen. See BRAND_KEY.
 */
const PHOTOS = {
  'iphone screen-assembly': 'iPhone Screen.png',
  'iphone lcd-panel': 'iPhone Screen.png',
  'iphone digitizer': 'iPhone Screen.png',
  'iphone battery': 'iPhone Battery.webp',
  'iphone charging-port': 'iPhone Charging Port.webp',
  'iphone charging-board': 'iPhone Charging Port.webp',
  'iphone rear-camera': 'iPhone Back Camera.webp',
  'iphone front-camera': 'iPhone Front Camera.webp',

  'samsung screen-assembly': 'Samsung Screen.webp',
  'samsung lcd-panel': 'Samsung Screen.webp',
  'samsung digitizer': 'Samsung Screen.webp',
  'samsung rear-camera': 'Samsung Back Camera.webp',
  'samsung front-camera': 'Samsung Front Camera.webp',
  'samsung back-glass': 'Samsung Backpart.webp',
  'samsung loud-speaker': 'Samsung Loudspeaker.webp',
  'samsung earpiece': 'Samsung Loudspeaker.webp',
  // The Samsung flex cable IS the charging-port flex — the part type is
  // literally "Charging Port Flex" — so it serves that type, not a type of
  // its own.
  'samsung charging-port': 'Samsung Flex Cable.webp',
  'samsung charging-board': 'Samsung Flex Cable.webp',

  'pixel screen-assembly': 'Pixel Screen.webp',
  'pixel lcd-panel': 'Pixel Screen.webp',
  'pixel digitizer': 'Pixel Screen.webp',
  'pixel rear-camera': 'Pixel Back Camera.webp',
  'pixel charging-port': 'Pixel Charging Port.webp',
  'pixel charging-board': 'Pixel Charging Port.webp',
  'pixel back-glass': 'Pixel Backpart.webp',
  'pixel loud-speaker': 'Pixel Speaker.webp',
  'pixel earpiece': 'Pixel Speaker.webp',

  'motorola screen-assembly': 'Motorola Screen.webp',
  'motorola lcd-panel': 'Motorola Screen.webp',
  'motorola digitizer': 'Motorola Screen.webp',
};

/**
 * brandSlug -> the key used above.
 *
 * Only PHONE slugs map. `apple-tablet`, `apple-laptop`, `apple-watch` and
 * `apple-computer` are deliberately absent: an iPhone screen photo on an iPad
 * or a MacBook listing is a picture of the wrong product, which is worse than
 * the line drawing it would replace. Those fall through to PartIllustration.
 */
const BRAND_KEY = {
  apple: 'iphone',
  samsung: 'samsung',
  google: 'pixel',
  motorola: 'motorola',
};

/**
 * The stock photo for a product, or null when there is none.
 *
 * Returns an encoded path — the filenames contain spaces, and an unencoded
 * space in a `src` is a broken image in some browsers.
 */
export function partPhoto(product) {
  if (!product) return null;

  const brand = BRAND_KEY[product.brandSlug];
  if (!brand) return null;

  const file = PHOTOS[`${brand} ${product.partType}`];
  if (!file) return null;

  // Encode each path SEGMENT, so spaces become %20 but the separators survive.
  return `${DIR}/${file}`
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * `product.image` first, then the brand stock photo. Null means the caller
 * should draw `PartIllustration` instead.
 */
export function productPhoto(product) {
  return product?.image || partPhoto(product);
}

export default productPhoto;
