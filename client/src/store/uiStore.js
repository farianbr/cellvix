import { create } from 'zustand';

/** Everything anchored to the header shares one dropdown slot. */
const DESKTOP = '(min-width: 1024px)';

/**
 * Overlay coordination. Only one of these should be open at a time — opening any
 * of them closes the others, so the header never stacks a mega menu behind an
 * account popup.
 */
export const useUiStore = create((set) => ({
  megaMenuOpen: false,
  mobileNavOpen: false,
  mobileNavTab: 'menu', // menu | categories
  cartFlyoutOpen: false,
  accountMenuOpen: false,
  accountPopupOpen: false,
  accountPopupTab: 'signin', // signin | signup | contact
  mobileFiltersOpen: false,
  announcementDismissed: false,

  // Bumped, never read for its value: the mobile header's LiveSearch focuses
  // itself whenever this changes. The bottom bar's search button is the only
  // caller — the header search bar is sticky and always on screen, so the right
  // behaviour is to put the cursor in it, not to open a second one.
  searchFocusToken: 0,

  openMegaMenu: () =>
    set({ megaMenuOpen: true, cartFlyoutOpen: false, accountPopupOpen: false, accountMenuOpen: false }),
  closeMegaMenu: () => set({ megaMenuOpen: false }),
  toggleMegaMenu: () =>
    set((s) => ({
      megaMenuOpen: !s.megaMenuOpen,
      cartFlyoutOpen: false,
      accountPopupOpen: false,
      accountMenuOpen: false,
    })),

  // `tab` lets the bottom bar's Categories button land on the drill-down
  // directly rather than on the site links.
  openMobileNav: (tab = 'menu') =>
    set({ mobileNavOpen: true, mobileNavTab: tab, cartFlyoutOpen: false, accountMenuOpen: false }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  setMobileNavTab: (mobileNavTab) => set({ mobileNavTab }),

  focusSearch: () =>
    set((s) => ({
      searchFocusToken: s.searchFocusToken + 1,
      mobileNavOpen: false,
      cartFlyoutOpen: false,
      megaMenuOpen: false,
      accountPopupOpen: false,
      accountMenuOpen: false,
    })),

  openCart: () =>
    set({ cartFlyoutOpen: true, megaMenuOpen: false, accountPopupOpen: false, accountMenuOpen: false }),
  closeCart: () => set({ cartFlyoutOpen: false }),
  // The cart is a dropdown anchored under its own trigger, so that button has
  // to close it again — the scrim never covers the header.
  toggleCart: () =>
    set((s) => ({
      cartFlyoutOpen: !s.cartFlyoutOpen,
      megaMenuOpen: false,
      accountPopupOpen: false,
      accountMenuOpen: false,
    })),

  /**
   * Add to Cart opens the mini-cart on desktop only.
   *
   * On a phone the dropdown covers the grid you are still shopping, so adding a
   * second part means dismissing it first. The card's own "Added" state, its
   * in-cart pill and the bottom bar's badge already confirm the add there.
   */
  openCartAfterAdd: () => {
    if (typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches) {
      set({ cartFlyoutOpen: true, megaMenuOpen: false, accountPopupOpen: false, accountMenuOpen: false });
    }
  },

  openAccountMenu: () =>
    set({ accountMenuOpen: true, cartFlyoutOpen: false, megaMenuOpen: false, accountPopupOpen: false }),
  closeAccountMenu: () => set({ accountMenuOpen: false }),
  toggleAccountMenu: () =>
    set((s) => ({
      accountMenuOpen: !s.accountMenuOpen,
      cartFlyoutOpen: false,
      megaMenuOpen: false,
      accountPopupOpen: false,
    })),

  openAccount: (tab = 'signin') =>
    set({
      accountPopupOpen: true,
      accountPopupTab: tab,
      megaMenuOpen: false,
      cartFlyoutOpen: false,
      accountMenuOpen: false,
    }),
  closeAccount: () => set({ accountPopupOpen: false }),
  setAccountTab: (accountPopupTab) => set({ accountPopupTab }),

  openMobileFilters: () => set({ mobileFiltersOpen: true }),
  closeMobileFilters: () => set({ mobileFiltersOpen: false }),

  dismissAnnouncement: () => set({ announcementDismissed: true }),
}));

export default useUiStore;
