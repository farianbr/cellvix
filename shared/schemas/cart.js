import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id.');

export const addItemSchema = z.object({
  productId: objectId,
  qty: z.coerce.number().int().min(1).max(9999).default(1),
});

export const setQtySchema = z.object({
  qty: z.coerce.number().int().min(0).max(9999),
});

/**
 * Guests build a cart in localStorage. On sign-in the client posts it here and
 * the server folds it into the account's cart.
 */
export const mergeCartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: objectId,
        qty: z.coerce.number().int().min(1).max(9999),
      }),
    )
    .max(200),
});

/** Bundles are added by slug from the offers page, or by id from the cart. */
export const addBundleSchema = z.object({
  offer: z.string().trim().min(1, 'Which bundle?').max(120),
  qty: z.coerce.number().int().min(1).max(999).default(1),
});

export const setBundleQtySchema = z.object({
  qty: z.coerce.number().int().min(0).max(999),
});

export const promoCodeSchema = z.object({
  code: z.string().trim().min(2, 'Enter a promo code.').max(24),
});

export const saveCartSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});
