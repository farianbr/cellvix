import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Cart state.
 *
 * Optimistic by design (brief §6): a card's Add to Cart updates this store
 * immediately so the badge and the header total move on the same frame as the
 * click. The server sync is fire-and-forget and reconciles afterwards; a failed
 * sync rolls the line back.
 *
 * Guests keep a local cart (persisted) which is merged on sign-in.
 */
export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [], // { productId, sku, name, grade, price, qty, image, modelName, priceVisible }
      lastAddedId: null,
      syncing: false,

      addItem(product, qty = 1) {
        set((state) => {
          const existing = state.items.find((item) => item.productId === product.id);
          const items = existing
            ? state.items.map((item) =>
                item.productId === product.id ? { ...item, qty: item.qty + qty } : item,
              )
            : [
                ...state.items,
                {
                  productId: product.id,
                  sku: product.sku,
                  name: product.name,
                  grade: product.grade,
                  modelName: product.modelName,
                  price: product.price ?? null,
                  priceVisible: product.priceVisible,
                  partType: product.partType,
                  qty,
                },
              ];
          return { items, lastAddedId: product.id };
        });
      },

      setQty(productId, qty) {
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((item) => item.productId !== productId)
              : state.items.map((item) => (item.productId === productId ? { ...item, qty } : item)),
        }));
      },

      removeItem(productId) {
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) }));
      },

      clear() {
        set({ items: [], lastAddedId: null });
      },

      qtyFor(productId) {
        return get().items.find((item) => item.productId === productId)?.qty ?? 0;
      },

      count() {
        return get().items.reduce((sum, item) => sum + item.qty, 0);
      },

      /** null when any line has a hidden price — a guest must not see a total. */
      subtotal() {
        const items = get().items;
        if (items.some((item) => !item.priceVisible || item.price === null)) return null;
        return items.reduce((sum, item) => sum + item.price * item.qty, 0);
      },
    }),
    {
      name: 'cellvix-cart',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export default useCartStore;
