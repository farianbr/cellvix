import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/**
 * `range` is `{ from, to }` as inclusive `YYYY-MM-DD` days, or omitted for the
 * server's default window. It is part of the query key, so the sidebar's
 * unranged badges and the dashboard's ranged figures are cached separately
 * rather than overwriting each other.
 */
export function useAdminStats(range) {
  const { canUseAdmin } = useAuth();
  const params = {};
  if (range?.from) params.from = range.from;
  if (range?.to) params.to = range.to;

  return useQuery({
    queryKey: ['admin', 'stats', params],
    queryFn: () => api.get('/admin/stats', params),
    enabled: canUseAdmin,
    staleTime: 30 * 1000,
  });
}

export function useAdminUsers(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get('/admin/users', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
    /**
     * Keep the previous response on screen while a new one loads.
     *
     * The status pills and the search box are part of the query key, so
     * changing one used to drop `data` to `undefined` for the length of the
     * round trip. Everything derived from it went with it — the counts on the
     * pills, the `Review N` button, the KPI figures — so the toolbar visibly
     * lost controls and then got them back, and the rows below jumped as the
     * header reflowed. Holding the last result means only the table body
     * changes, which is the only thing that actually did.
     */
    placeholderData: (previous) => previous,
  });
}

export function useAdminUser(id) {
  return useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => api.get(`/admin/users/${id}`),
    enabled: Boolean(id),
  });
}

/** One account's store-credit statement, for the customer drawer. */
export function useAdminStoreCredit(id) {
  return useQuery({
    queryKey: ['admin', 'store-credit', id],
    queryFn: () => api.get(`/admin/users/${id}/store-credit`),
    enabled: Boolean(id),
  });
}

export function useAdminProducts(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: () => api.get('/admin/products', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminOrders(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: () => api.get('/admin/orders', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

/**
 * One order, by number — the detail screen (phase 12).
 *
 * Keyed on the order number rather than an id, matching the route and the
 * endpoint: that is the identifier a packing slip and a customer email carry.
 */
export function useAdminOrder(orderNumber) {
  return useQuery({
    queryKey: ['admin', 'orders', 'one', orderNumber],
    queryFn: () => api.get(`/admin/orders/${orderNumber}`),
    enabled: Boolean(orderNumber),
  });
}

export function useAdminBlog(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'blog', params],
    queryFn: () => api.get('/admin/blog', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

/** The list payload omits `body`; the editor needs it, so it fetches one post. */
export function useAdminBlogPost(id) {
  return useQuery({
    queryKey: ['admin', 'blog', 'post', id],
    queryFn: () => api.get(`/admin/blog/${id}`),
    select: (payload) => payload.post,
    enabled: Boolean(id),
  });
}

export function useAdminFaqs(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'faqs', params],
    queryFn: () => api.get('/admin/faqs', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminOffers(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'offers', params],
    queryFn: () => api.get('/admin/offers', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminInvoices(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'invoices', params],
    queryFn: () => api.get('/admin/invoices', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminInvoice(number) {
  return useQuery({
    queryKey: ['admin', 'invoices', 'one', number],
    queryFn: () => api.get(`/admin/invoices/${number}`),
    enabled: Boolean(number),
  });
}

/** The Activity tab: orders, invoices, payments and credit movements, merged. */
export function useAdminUserActivity(id, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'users', id, 'activity'],
    queryFn: () => api.get(`/admin/users/${id}/activity`),
    enabled: Boolean(id) && enabled,
  });
}

// ---- purchase (phase 5) -----------------------------------------------------

export function useAdminSuppliers(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'suppliers', params],
    queryFn: () => api.get('/admin/suppliers', params),
    enabled: canUseAdmin,
    staleTime: 30 * 1000,
  });
}

export function useAdminSupplier(id) {
  return useQuery({
    queryKey: ['admin', 'suppliers', 'one', id],
    queryFn: () => api.get(`/admin/suppliers/${id}`),
    enabled: Boolean(id),
  });
}

// ---- requests for quote (supplier process flow, §6.8a) ----------------------

export function useAdminRfqs(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'rfqs', params],
    queryFn: () => api.get('/admin/rfqs', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminRfq(id) {
  return useQuery({
    queryKey: ['admin', 'rfqs', 'one', id],
    queryFn: () => api.get(`/admin/rfqs/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * The supplier picker: who is tagged with these component types.
 *
 * Disabled until at least one type is chosen, because the endpoint answers with
 * nothing rather than everything — an empty filter must not put a hundred
 * suppliers in front of somebody who has not said what they are buying yet.
 */
export function useSuppliersForComponentTypes(componentTypes = []) {
  const { canUseAdmin } = useAuth();
  const types = componentTypes.filter(Boolean);

  return useQuery({
    queryKey: ['admin', 'rfqs', 'suppliers', types],
    queryFn: () => api.get('/admin/rfqs/suppliers', { componentTypes: types }),
    enabled: canUseAdmin && types.length > 0,
    staleTime: 60 * 1000,
  });
}

export function useAdminPurchaseOrders(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'purchase-orders', params],
    queryFn: () => api.get('/admin/purchase-orders', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminPurchaseOrder(id) {
  return useQuery({
    queryKey: ['admin', 'purchase-orders', 'one', id],
    queryFn: () => api.get(`/admin/purchase-orders/${id}`),
    enabled: Boolean(id),
  });
}

export function useAdminExpenses(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'expenses', params],
    queryFn: () => api.get('/admin/expenses', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

/** Categories carry their usage count, so the UI can explain a refused delete
 *  before the operator clicks it rather than after. */
export function useAdminExpenseCategories() {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'expense-categories'],
    queryFn: () => api.get('/admin/expenses/categories'),
    enabled: canUseAdmin,
    staleTime: 60 * 1000,
  });
}

/**
 * `enabled` is explicit because the purchase-order form needs the whole
 * catalogue to populate its product picker and nothing else on that screen
 * does — fetching 400+ rows to render a list of purchase orders is waste.
 */
export function useAdminInventory(params, enabled = true) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'inventory', params],
    queryFn: () => api.get('/admin/inventory', params),
    enabled: canUseAdmin && enabled,
    staleTime: 15 * 1000,
  });
}

export function useAdminInventoryItem(id) {
  return useQuery({
    queryKey: ['admin', 'inventory', 'one', id],
    queryFn: () => api.get(`/admin/inventory/${id}`),
    enabled: Boolean(id),
  });
}

// ---- quotes & RMA (phase 7) -------------------------------------------------

/**
 * Web quotes: enquiries the storefront contact form sent in.
 *
 * `undefined` params means the caller does not want the list yet — the
 * customer profile only fetches on its own tab.
 */
export function useAdminWebQuotes(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'web-quotes', params],
    queryFn: () => api.get('/admin/web-quotes', params),
    enabled: canUseAdmin && params !== undefined,
    staleTime: 15 * 1000,
    placeholderData: (previous) => previous,
  });
}

export function useAdminQuotes(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'quotes', params],
    queryFn: () => api.get('/admin/quotes', params),
    // `undefined` params means the caller does not want the list yet — the
    // customer profile only fetches on its Quotes tab. Without this the hook
    // would fetch every quote in the system to render nothing.
    enabled: canUseAdmin && params !== undefined,
    staleTime: 15 * 1000,
  });
}

/** Carries the live price comparison alongside the quote, so a screen can show
 *  the catalogue moving under a promise while it is still open. */
export function useAdminQuote(id) {
  return useQuery({
    queryKey: ['admin', 'quotes', 'one', id],
    queryFn: () => api.get(`/admin/quotes/${id}`),
    enabled: Boolean(id),
  });
}

export function useAdminRmas(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'rma', params],
    queryFn: () => api.get('/admin/rma', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminRma(id) {
  return useQuery({
    queryKey: ['admin', 'rma', 'one', id],
    queryFn: () => api.get(`/admin/rma/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * Repair tickets. `params` carries the status pill, the search, the priority
 * and technician filters and the page — all of it in the key, so paging back
 * to a page already seen is instant.
 */
export function useAdminTickets(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'tickets', params],
    queryFn: () => api.get('/admin/tickets', params),
    // `undefined` params means the caller does not want the list yet — the
    // customer profile only fetches on its Tickets tab. Without this the hook
    // would fetch *every* ticket in the shop to render nothing.
    enabled: canUseAdmin && params !== undefined,
    staleTime: 15 * 1000,
    // A list that reflows under the operator while they read a row is worse
    // than one a few seconds stale, but a page of tickets is a live board —
    // keeping the previous page on screen during a refetch is the compromise.
    placeholderData: (previous) => previous,
  });
}

export function useAdminTicket(id) {
  return useQuery({
    queryKey: ['admin', 'tickets', 'one', id],
    queryFn: () => api.get(`/admin/tickets/${id}`),
    enabled: Boolean(id),
  });
}

// ---- reports (phase 6) ------------------------------------------------------

/**
 * One report tab. `range` is `{ from, to }` as inclusive `YYYY-MM-DD` days and
 * is part of the query key, so two tabs at two ranges cache separately.
 *
 * `staleTime` is longer than a list's: a report is a considered read of a
 * period, not a live board, and refetching it under the operator while they are
 * reading a column is worse than showing a figure a minute old.
 */
export function useAdminReport(tab, range, extra) {
  const { canUseAdmin } = useAuth();
  const params = { ...extra };
  if (range?.from) params.from = range.from;
  if (range?.to) params.to = range.to;

  return useQuery({
    queryKey: ['admin', 'reports', tab, params],
    queryFn: () => api.get(`/admin/reports/${tab}`, params),
    enabled: canUseAdmin && Boolean(tab),
    staleTime: 60 * 1000,
  });
}

/**
 * Admin mutations.
 *
 * Approving a business changes what that account can see everywhere, so the
 * whole admin cache is invalidated rather than surgically patched — these are
 * low-frequency, high-consequence actions.
 */
// ---- phase 8: outlets, roles and staff --------------------------------------

export function useAdminOutlets(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'outlets', params],
    queryFn: () => api.get('/admin/outlets', params),
    enabled: canUseAdmin,
    staleTime: 30 * 1000,
  });
}

export function useAdminOutlet(id) {
  return useQuery({
    queryKey: ['admin', 'outlets', id],
    queryFn: () => api.get(`/admin/outlets/${id}`),
    enabled: Boolean(id),
  });
}

/** The next `#000001` code, so the Add form can show it before saving. */
export function useNextOutletCode(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'outlets', 'next-code'],
    queryFn: () => api.get('/admin/outlets/next-code'),
    enabled,
    staleTime: 0,
  });
}

/** Admin-only endpoints — a staff session gets a 403, so it never asks. */
export function useAdminRoles() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api.get('/admin/roles'),
    enabled: isAdmin,
    staleTime: 30 * 1000,
  });
}

export function useAdminStaff(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'staff', params],
    queryFn: () => api.get('/admin/staff', params),
    enabled: isAdmin,
    staleTime: 15 * 1000,
  });
}

// ---- phase 9: marketing -----------------------------------------------------

/**
 * Channel states and the counts above each marketing screen.
 *
 * `channels` is the one source of truth for which providers are connected
 * (§6b) — the notices on the SMS, WhatsApp and Calls screens read it rather
 * than each hard-coding its own wording.
 */
export function useMarketingSummary() {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'marketing', 'summary'],
    queryFn: () => api.get('/admin/marketing/summary'),
    enabled: canUseAdmin,
    staleTime: 30 * 1000,
  });
}

/**
 * The history panel. `channel` scopes it; `user` narrows it to one account.
 *
 * Passing `undefined` skips the fetch, which is how a caller that only wants
 * the history on one tab avoids paying for it on every other one.
 */
export function useMarketingMessages(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'marketing', 'messages', params ?? null],
    queryFn: () => api.get('/admin/marketing/messages', params),
    enabled: canUseAdmin && params !== undefined,
    staleTime: 10 * 1000,
  });
}

export function useMarketingTemplates(channel) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'marketing', 'templates', channel ?? 'all'],
    queryFn: () => api.get('/admin/marketing/templates', channel ? { channel } : {}),
    enabled: canUseAdmin,
    staleTime: 60 * 1000,
  });
}

export function useMarketingCampaigns(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'marketing', 'campaigns', params],
    queryFn: () => api.get('/admin/marketing/campaigns', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
  });
}

/**
 * One campaign, with its audience recounted server-side on every read —
 * consent moves between saves, and the count shown is the one the operator uses
 * to decide whether to send.
 */
export function useMarketingCampaign(id) {
  return useQuery({
    queryKey: ['admin', 'marketing', 'campaigns', id],
    queryFn: () => api.get(`/admin/marketing/campaigns/${id}`),
    enabled: Boolean(id),
  });
}

export function useMarketingUnsubscribes(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'marketing', 'unsubscribes', params],
    queryFn: () => api.get('/admin/marketing/unsubscribes', params),
    enabled: canUseAdmin,
    staleTime: 30 * 1000,
  });
}

// ---- phase 10: referral commission ------------------------------------------

/**
 * Referrals and the commission rate.
 *
 * Admin-only — a staff session gets a 403, so it never asks (§6.13). This pays
 * real money on an automatic trigger, which is a decision for whoever owns the
 * money rather than anyone holding `marketing: full`.
 */
export function useAdminReferrals(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'referrals', params],
    queryFn: () => api.get('/admin/referrals', params),
    enabled: isAdmin,
    staleTime: 30 * 1000,
  });
}

// ---- phase 11a: settings ----------------------------------------------------

/**
 * The settings singleton.
 *
 * One query behind every settings screen: the document is small, it is read by
 * six forms, and a per-screen query would mean six caches that can disagree
 * about the same field.
 *
 * `staleTime` is longer than the panel's default because settings change on the
 * order of months, not minutes — and every mutation invalidates `['admin']`
 * anyway, so an edit still lands immediately.
 */
/** Returns going back to a supplier (Purchase § RMA / Returns). */
export function useSupplierReturns(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'supplier-returns', params],
    queryFn: () => api.get('/admin/supplier-returns', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
    placeholderData: (previous) => previous,
  });
}

/** Bought-in services and supplier subscriptions. `kind` picks which screen. */
export function useSupplierServices(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'supplier-services', params],
    queryFn: () => api.get('/admin/supplier-services', params),
    enabled: canUseAdmin,
    staleTime: 15 * 1000,
    placeholderData: (previous) => previous,
  });
}

export function useSupplierReturn(id) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'supplier-returns', id],
    queryFn: () => api.get(`/admin/supplier-returns/${id}`),
    enabled: canUseAdmin && Boolean(id),
  });
}

export function useAdminSettings() {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get('/admin/settings'),
    enabled: canUseAdmin,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- phase 12c: notifications (§7.3) ----------------------------------------

/**
 * The bell's contents.
 *
 * **Polled, as §7.3 specifies** — "polled on an interval to start, upgraded to
 * SSE only if that proves necessary". One minute is the interval: the four
 * standing conditions are recomputed on every read, so a shorter one buys
 * freshness nobody can act on while multiplying a query that touches invoices,
 * products and purchase orders.
 *
 * `refetchIntervalInBackground` is left at its default of false on purpose. A
 * panel sitting in an unfocused tab overnight should not spend the night
 * re-running that query, and the refetch on focus catches it up the instant
 * somebody comes back.
 */
export function useNotifications() {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => api.get('/admin/notifications'),
    enabled: canUseAdmin,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Marking read and clearing.
 *
 * Both invalidate rather than optimistically patching the cache: the derived
 * half of the list is recomputed server-side and a local edit cannot model it,
 * so guessing would show a badge that disagrees with the next poll.
 */
export function useNotificationActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });

  return {
    markRead: useMutation({
      mutationFn: (ids) => api.post('/admin/notifications/read', ids ? { ids } : {}),
      onSuccess: invalidate,
    }),
    clearAll: useMutation({
      mutationFn: () => api.post('/admin/notifications/clear'),
      onSuccess: invalidate,
    }),
  };
}

// ---- phase 11b: the audit trail ---------------------------------------------

/**
 * One page of the activity or security log.
 *
 * `kind` picks the endpoint rather than being sent as a parameter — the server
 * decides which log a route reads, so a client cannot ask the activity route
 * for security rows.
 *
 * The security log is admin-only, so a staff session never asks for it: it
 * would only ever receive a 403.
 */
export function useAuditLog(kind, params) {
  const { canUseAdmin, isAdmin } = useAuth();
  const allowed = kind === 'security' ? isAdmin : canUseAdmin;

  return useQuery({
    queryKey: ['admin', 'audit', kind, params],
    queryFn: () => api.get(`/admin/audit/${kind}`, params),
    enabled: allowed,
    // Short: a log is read to find out what just happened, and a stale page
    // is the one thing it must not show.
    staleTime: 10 * 1000,
    placeholderData: (previous) => previous,
  });
}

// ---- phase 11c: provider credentials ----------------------------------------

/**
 * Which providers are configured, and a masked preview of each field.
 *
 * **Never the values.** The server has no route that returns a stored secret
 * (§6.15), so there is nothing to fetch and nothing to cache: what comes back
 * is `configured`, `source` and a preview like `••••••••1234`.
 *
 * Admin-only — a staff session would only ever get a 403, so it never asks.
 */
export function useAdminCredentials() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'credentials'],
    queryFn: () => api.get('/admin/credentials'),
    enabled: isAdmin,
    staleTime: 60 * 1000,
  });
}

// ---- phase 11d: taxonomy & invoice status rules -----------------------------

export function useAdminTaxonomy(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'taxonomy', params],
    queryFn: () => api.get('/admin/taxonomy', params),
    enabled: canUseAdmin,
    staleTime: 30 * 1000,
    placeholderData: (previous) => previous,
  });
}

export function useAdminInvoiceRules() {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'invoice-rules'],
    queryFn: () => api.get('/admin/invoice-rules'),
    enabled: canUseAdmin,
    staleTime: 60 * 1000,
  });
}

// ---- phase 11e: scheduling board (UI only, §6b U1–U2) -----------------------

/**
 * The scheduling board's data. Ships empty and there is no write hook — the
 * screens render their chrome and say plainly that nothing is wired.
 */
export function useAdminAppointments(params) {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'appointments', params],
    queryFn: () => api.get('/admin/appointments', params),
    enabled: canUseAdmin,
    staleTime: 60 * 1000,
  });
}

// ---- phase 12: global search & profile --------------------------------------

/**
 * Record search behind Ctrl+K (§7.1).
 *
 * Results are **permission-filtered server-side** from the caller's role, so
 * there is nothing to pass here and nothing this hook could ask for that the
 * session is not entitled to.
 *
 * Disabled under two characters, matching the server's own floor — otherwise
 * every palette open fires a request that returns nothing.
 */
export function useAdminSearch(term) {
  const { canUseAdmin } = useAuth();
  const q = (term ?? '').trim();

  return useQuery({
    queryKey: ['admin', 'search', q],
    queryFn: () => api.get('/admin/search', { q }),
    enabled: canUseAdmin && q.length >= 2,
    staleTime: 15 * 1000,
    placeholderData: (previous) => previous,
  });
}

/** The signed-in staff member's own profile and recent activity. */
export function useAdminProfile() {
  const { canUseAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'profile'],
    queryFn: () => api.get('/admin/profile'),
    enabled: canUseAdmin,
    staleTime: 60 * 1000,
  });
}

export function useAdminMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  // Editorial writes are the admin's copy of a page the storefront also caches.
  // Invalidating both is what makes a publish show up without a hard refresh.
  const invalidateContent = (publicKey) => () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: [publicKey] });
  };

  return {
    createUser: useMutation({
      mutationFn: (body) => api.post('/admin/users', body),
      onSuccess: invalidate,
    }),
    updateUser: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/users/${id}`, body),
      onSuccess: invalidate,
    }),
    createSupplierReturn: useMutation({
      mutationFn: (body) => api.post('/admin/supplier-returns', body),
      onSuccess: invalidate,
    }),
    setSupplierReturnStatus: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/supplier-returns/${id}/status`, body),
      onSuccess: invalidate,
    }),
    recordSupplierCredit: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/supplier-returns/${id}/credit`, body),
      onSuccess: invalidate,
    }),
    deleteSupplierReturn: useMutation({
      mutationFn: (id) => api.delete(`/admin/supplier-returns/${id}`),
      onSuccess: invalidate,
    }),

    createSupplierService: useMutation({
      mutationFn: (body) => api.post('/admin/supplier-services', body),
      onSuccess: invalidate,
    }),
    updateSupplierService: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/supplier-services/${id}`, body),
      onSuccess: invalidate,
    }),
    recordSupplierCharge: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/supplier-services/${id}/charges`, body),
      onSuccess: invalidate,
    }),
    cancelSupplierService: useMutation({
      mutationFn: ({ id, cancelled }) =>
        api.patch(`/admin/supplier-services/${id}/cancel`, { cancelled }),
      onSuccess: invalidate,
    }),
    deleteSupplierService: useMutation({
      mutationFn: (id) => api.delete(`/admin/supplier-services/${id}`),
      onSuccess: invalidate,
    }),

    setContactConsent: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/users/${id}/consent`, body),
      onSuccess: invalidate,
    }),
    setTier: useMutation({
      mutationFn: ({ id, tier }) => api.patch(`/admin/users/${id}/tier`, { tier }),
      onSuccess: invalidate,
    }),
    addInternalNote: useMutation({
      mutationFn: ({ id, body }) => api.post(`/admin/users/${id}/notes`, { body }),
      onSuccess: invalidate,
    }),
    deleteInternalNote: useMutation({
      mutationFn: ({ id, noteId }) => api.delete(`/admin/users/${id}/notes/${noteId}`),
      onSuccess: invalidate,
    }),
    approveUser: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/users/${id}/approve`, body),
      onSuccess: invalidate,
    }),
    rejectUser: useMutation({
      mutationFn: ({ id, reason }) => api.patch(`/admin/users/${id}/reject`, { reason }),
      onSuccess: invalidate,
    }),
    setUserStatus: useMutation({
      mutationFn: ({ id, status }) => api.patch(`/admin/users/${id}/status`, { status }),
      onSuccess: invalidate,
    }),
    setCredit: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/users/${id}/credit`, body),
      onSuccess: invalidate,
    }),
    allocateStoreCredit: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/users/${id}/store-credit`, body),
      onSuccess: (_payload, variables) => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['admin', 'store-credit', variables.id] });
      },
    }),
    // An order raised by hand. It takes stock and raises an invoice exactly as
    // a checkout does, so the storefront's own order list moved too.
    createOrder: useMutation({
      mutationFn: (body) => api.post('/admin/orders', body),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }),
    refundOrder: useMutation({
      mutationFn: ({ orderNumber, ...body }) =>
        api.post(`/admin/orders/${orderNumber}/refund`, body),
      onSuccess: invalidate,
    }),

    // Partial by design: this resolves to `{ updated, skipped }`, and the caller
    // is expected to show the skips rather than report a clean success.
    bulkOrderStatus: useMutation({
      mutationFn: (body) => api.patch('/admin/orders/bulk-status', body),
      onSuccess: invalidate,
    }),

    // A standalone invoice — no order behind it. On terms it draws on the line
    // of credit, so the client's own account view moved as well.
    createInvoice: useMutation({
      mutationFn: (body) => api.post('/admin/invoices', body),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      },
    }),
    recordInvoicePayment: useMutation({
      mutationFn: ({ number, ...body }) => api.post(`/admin/invoices/${number}/payments`, body),
      onSuccess: invalidate,
    }),
    voidInvoice: useMutation({
      mutationFn: ({ number, reason }) => api.post(`/admin/invoices/${number}/void`, { reason }),
      onSuccess: invalidate,
    }),
    // Resolves to `{ delivered, to }`. The caller reads `delivered` rather than
    // treating a 200 as proof the customer has the document — the transport can
    // accept the request and still refuse the message.
    // Cash at the counter against the line of credit. Resolves to the invoices
    // it actually landed on, so the UI can name them rather than say "done".
    recordCreditPayment: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/users/${id}/credit-payment`, body),
      onSuccess: invalidate,
    }),
    reverseInvoicePayment: useMutation({
      mutationFn: ({ number, index, ...body }) =>
        api.post(`/admin/invoices/${number}/payments/${index}/reverse`, body),
      onSuccess: invalidate,
    }),
    emailInvoice: useMutation({
      mutationFn: ({ number }) => api.post(`/admin/invoices/${number}/email`, {}),
      onSuccess: invalidate,
    }),
    updateInvoice: useMutation({
      mutationFn: ({ number, ...body }) => api.patch(`/admin/invoices/${number}`, body),
      onSuccess: invalidate,
    }),
    deleteInvoice: useMutation({
      mutationFn: ({ number }) => api.delete(`/admin/invoices/${number}`),
      onSuccess: invalidate,
    }),

    createProduct: useMutation({
      mutationFn: (body) => api.post('/admin/products', body),
      onSuccess: () => {
        invalidate();
        // The storefront's catalogue and category tree both moved.
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
      },
    }),
    updateProduct: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/products/${id}`, body),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }),
    toggleProduct: useMutation({
      mutationFn: (id) => api.delete(`/admin/products/${id}`),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }),

    updateOrderStatus: useMutation({
      mutationFn: ({ orderNumber, ...body }) =>
        api.patch(`/admin/orders/${orderNumber}/status`, body),
      onSuccess: () => {
        invalidate();
        // The buyer-side tracking page reads the same order.
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
    }),

    createPost: useMutation({
      mutationFn: (body) => api.post('/admin/blog', body),
      onSuccess: invalidateContent('blog'),
    }),
    updatePost: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/blog/${id}`, body),
      onSuccess: invalidateContent('blog'),
    }),
    deletePost: useMutation({
      mutationFn: (id) => api.delete(`/admin/blog/${id}`),
      onSuccess: invalidateContent('blog'),
    }),

    createFaq: useMutation({
      mutationFn: (body) => api.post('/admin/faqs', body),
      onSuccess: () => {
        invalidateContent('faq')();
        // Product-scoped entries render inside the product detail payload.
        queryClient.invalidateQueries({ queryKey: ['product'] });
      },
    }),
    updateFaq: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/faqs/${id}`, body),
      onSuccess: () => {
        invalidateContent('faq')();
        queryClient.invalidateQueries({ queryKey: ['product'] });
      },
    }),
    deleteFaq: useMutation({
      mutationFn: (id) => api.delete(`/admin/faqs/${id}`),
      onSuccess: () => {
        invalidateContent('faq')();
        queryClient.invalidateQueries({ queryKey: ['product'] });
      },
    }),

    createOffer: useMutation({
      mutationFn: (body) => api.post('/admin/offers', body),
      onSuccess: invalidateContent('offers'),
    }),
    updateOffer: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/offers/${id}`, body),
      onSuccess: invalidateContent('offers'),
    }),
    deleteOffer: useMutation({
      mutationFn: (id) => api.delete(`/admin/offers/${id}`),
      onSuccess: invalidateContent('offers'),
    }),

    // ---- purchase (phase 5) -------------------------------------------------

    createSupplier: useMutation({
      mutationFn: (body) => api.post('/admin/suppliers', body),
      onSuccess: invalidate,
    }),
    updateSupplier: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/suppliers/${id}`, body),
      onSuccess: invalidate,
    }),
    toggleSupplier: useMutation({
      mutationFn: (id) => api.delete(`/admin/suppliers/${id}`),
      onSuccess: invalidate,
    }),

    /**
     * Email this supplier their portal link and a fresh password.
     *
     * Resolves to `{ delivered, error }` rather than throwing on a mail
     * failure — the credential is reset either way, and the screen has to be
     * able to say "reset, but the email did not send" instead of claiming a
     * success that never left the building.
     */
    inviteSupplierPortal: useMutation({
      mutationFn: (id) => api.post(`/admin/suppliers/${id}/portal-invite`, {}),
      onSuccess: invalidate,
    }),

    // ---- requests for quote (supplier process flow, §6.8a) ------------------

    createRfq: useMutation({
      mutationFn: (body) => api.post('/admin/rfqs', body),
      onSuccess: invalidate,
    }),
    updateRfq: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/rfqs/${id}`, body),
      onSuccess: invalidate,
    }),
    // Resolves to `{ sent, failed }`: one bad address must not stop the rest
    // going out, so the caller shows who was not reached rather than reporting
    // a clean success.
    sendRfq: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/rfqs/${id}/send`, body),
      onSuccess: invalidate,
    }),
    inviteRfqSupplier: useMutation({
      mutationFn: ({ id, supplier }) => api.post(`/admin/rfqs/${id}/invite`, { supplier }),
      onSuccess: invalidate,
    }),
    // Raises a real purchase order, so the PO lists move too.
    awardRfq: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/rfqs/${id}/award`, body),
      onSuccess: invalidate,
    }),
    cancelRfq: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/rfqs/${id}/cancel`, body),
      onSuccess: invalidate,
    }),

    createPurchaseOrder: useMutation({
      mutationFn: (body) => api.post('/admin/purchase-orders', body),
      onSuccess: invalidate,
    }),
    updatePurchaseOrder: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/purchase-orders/${id}`, body),
      onSuccess: invalidate,
    }),
    setPurchaseOrderStatus: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/purchase-orders/${id}/status`, body),
      onSuccess: invalidate,
    }),

    // Partial by design, like the bulk order action: this resolves to
    // `{ received, skipped }` and the caller shows the skips rather than
    // reporting a clean success.
    receivePurchaseOrder: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/purchase-orders/${id}/receive`, body),
      onSuccess: () => {
        invalidate();
        // Receiving moved stock, so the storefront's in-stock flags moved too.
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }),
    // Creates the expense row. Refused if this PO has already been paid.
    recordPurchasePayment: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/purchase-orders/${id}/payment`, body),
      onSuccess: invalidate,
    }),

    createExpense: useMutation({
      mutationFn: (body) => api.post('/admin/expenses', body),
      onSuccess: invalidate,
    }),
    updateExpense: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/expenses/${id}`, body),
      onSuccess: invalidate,
    }),
    deleteExpense: useMutation({
      mutationFn: (id) => api.delete(`/admin/expenses/${id}`),
      onSuccess: invalidate,
    }),

    createExpenseCategory: useMutation({
      mutationFn: (body) => api.post('/admin/expenses/categories', body),
      onSuccess: invalidate,
    }),
    updateExpenseCategory: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/expenses/categories/${id}`, body),
      onSuccess: invalidate,
    }),
    // Resolves to `{ deactivated }` — a category in use is deactivated, and the
    // caller is expected to say which of the two happened.
    deleteExpenseCategory: useMutation({
      mutationFn: (id) => api.delete(`/admin/expenses/categories/${id}`),
      onSuccess: invalidate,
    }),

    updateInventoryOps: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/inventory/${id}/ops`, body),
      onSuccess: invalidate,
    }),
    adjustStock: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/inventory/${id}/adjust`, body),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }),

    // ---- quotes & RMA (phase 7) --------------------------------------------

    createQuote: useMutation({
      mutationFn: (body) => api.post('/admin/quotes', body),
      onSuccess: invalidate,
    }),
    updateQuote: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/quotes/${id}`, body),
      onSuccess: invalidate,
    }),
    setWebQuoteStatus: useMutation({
      mutationFn: ({ id, status }) => api.patch(`/admin/web-quotes/${id}/status`, { status }),
      onSuccess: invalidate,
    }),
    setQuoteStatus: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/quotes/${id}/status`, body),
      onSuccess: invalidate,
    }),
    /**
     * Conversion. Rejects with `QUOTE_PRICE_DRIFT` and the comparison in
     * `error.fields.drift` when catalogue prices have moved — the caller shows
     * that and retries with `acknowledgeDrift`, which is the admin's decision
     * to honour the quoted price anyway.
     */
    convertQuote: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/quotes/${id}/convert`, body),
      onSuccess: () => {
        invalidate();
        // A conversion writes an order, an invoice and moves stock.
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }),
    deleteQuote: useMutation({
      mutationFn: (id) => api.delete(`/admin/quotes/${id}`),
      onSuccess: invalidate,
    }),

    createTicket: useMutation({
      mutationFn: (body) => api.post('/admin/tickets', body),
      onSuccess: invalidate,
    }),
    updateTicket: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/tickets/${id}`, body),
      onSuccess: invalidate,
    }),
    /** Status is its own call because only it writes the ticket timeline. */
    setTicketStatus: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/tickets/${id}/status`, body),
      onSuccess: invalidate,
    }),
    deleteTicket: useMutation({
      mutationFn: (id) => api.delete(`/admin/tickets/${id}`),
      onSuccess: invalidate,
    }),

    createRma: useMutation({
      mutationFn: (body) => api.post('/admin/rma', body),
      onSuccess: invalidate,
    }),
    setRmaStatus: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/rma/${id}/status`, body),
      onSuccess: invalidate,
    }),
    inspectRma: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/rma/${id}/inspect`, body),
      onSuccess: invalidate,
    }),
    /** Resolves to `{ restocked, refund }` — the caller says what actually
     *  moved rather than reporting a bare success. */
    resolveRma: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/admin/rma/${id}/resolve`, body),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }),

    // ---- phase 8 ----------------------------------------------------------
    createOutlet: useMutation({
      mutationFn: (body) => api.post('/admin/outlets', body),
      onSuccess: invalidate,
    }),
    updateOutlet: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/outlets/${id}`, body),
      onSuccess: invalidate,
    }),
    setDefaultOutlet: useMutation({
      mutationFn: (id) => api.patch(`/admin/outlets/${id}/default`),
      onSuccess: invalidate,
    }),
    deleteOutlet: useMutation({
      mutationFn: (id) => api.delete(`/admin/outlets/${id}`),
      onSuccess: invalidate,
    }),

    createRole: useMutation({
      mutationFn: (body) => api.post('/admin/roles', body),
      onSuccess: invalidate,
    }),
    updateRole: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/roles/${id}`, body),
      // A role edit changes what the editor themselves may see, so the session
      // is refetched alongside the admin caches.
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      },
    }),
    deleteRole: useMutation({
      mutationFn: (id) => api.delete(`/admin/roles/${id}`),
      onSuccess: invalidate,
    }),

    createStaff: useMutation({
      mutationFn: (body) => api.post('/admin/staff', body),
      onSuccess: invalidate,
    }),
    updateStaff: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/staff/${id}`, body),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      },
    }),
    deleteStaff: useMutation({
      mutationFn: (id) => api.delete(`/admin/staff/${id}`),
      onSuccess: invalidate,
    }),

    // ---- phase 9 ----------------------------------------------------------
    // Every compose resolves to `{ message, notice }`. `notice` is non-null
    // when the channel could not actually send, and the screen must render it
    // instead of a confirmation — §6b rule 4, no fake success.
    sendMessage: useMutation({
      mutationFn: ({ channel, ...body }) => api.post(`/admin/marketing/${channel}`, body),
      onSuccess: invalidate,
    }),

    createTemplate: useMutation({
      mutationFn: (body) => api.post('/admin/marketing/templates', body),
      onSuccess: invalidate,
    }),
    updateTemplate: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/marketing/templates/${id}`, body),
      onSuccess: invalidate,
    }),
    deleteTemplate: useMutation({
      mutationFn: (id) => api.delete(`/admin/marketing/templates/${id}`),
      onSuccess: invalidate,
    }),

    createCampaign: useMutation({
      mutationFn: (body) => api.post('/admin/marketing/campaigns', body),
      onSuccess: invalidate,
    }),
    updateCampaign: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/marketing/campaigns/${id}`, body),
      onSuccess: invalidate,
    }),
    deleteCampaign: useMutation({
      mutationFn: (id) => api.delete(`/admin/marketing/campaigns/${id}`),
      onSuccess: invalidate,
    }),
    // Resolves to `{ campaign, result }`, where `result` carries sent / queued
    // / failed / skipped. The screen reports those four numbers rather than a
    // single "sent" — a partial run says so.
    sendCampaign: useMutation({
      mutationFn: (id) => api.post(`/admin/marketing/campaigns/${id}/send`),
      onSuccess: invalidate,
    }),

    resubscribe: useMutation({
      mutationFn: (id) => api.post(`/admin/marketing/unsubscribes/${id}/resubscribe`),
      onSuccess: invalidate,
    }),

    // ---- phase 10 ---------------------------------------------------------
    // The only writable thing in the whole referral feature. Accruals are
    // produced by payments and reversed by refunds — there is no mutation that
    // writes one by hand, and attribution is set once at registration.
    setReferralRate: useMutation({
      mutationFn: (percent) => api.patch('/admin/referrals/rate', { percent }),
      onSuccess: invalidate,
    }),

    // ---- phase 11a: settings ------------------------------------------------
    // One mutation per section, mirroring the routes. There is no whole-document
    // write: a form posts back the copy it loaded on open, so a wholesale save
    // would let one screen silently revert a field another screen just changed.
    saveBusinessInfo: useMutation({
      mutationFn: (body) => api.patch('/admin/settings/business', body),
      onSuccess: invalidate,
    }),
    saveSaleSettings: useMutation({
      mutationFn: (body) => api.patch('/admin/settings/sale', body),
      onSuccess: invalidate,
    }),
    saveShippingSettings: useMutation({
      mutationFn: (body) => api.patch('/admin/settings/shipping', body),
      onSuccess: invalidate,
    }),
    savePaymentMethods: useMutation({
      mutationFn: (body) => api.patch('/admin/settings/payment-methods', body),
      onSuccess: invalidate,
    }),
    saveInventorySettings: useMutation({
      mutationFn: (body) => api.patch('/admin/settings/inventory', body),
      onSuccess: invalidate,
    }),

    // ---- phase 11c: provider credentials -----------------------------------
    // Write-only. The response carries previews and `configured` flags, never
    // the values that were just sent — so nothing here caches a secret.
    saveCredentials: useMutation({
      mutationFn: ({ provider, ...values }) => api.patch(`/admin/credentials/${provider}`, values),
      onSuccess: invalidate,
    }),
    clearCredentials: useMutation({
      mutationFn: (provider) => api.delete(`/admin/credentials/${provider}`),
      onSuccess: invalidate,
    }),

    // ---- phase 11d: taxonomy & invoice status rules ------------------------
    // Taxonomy writes invalidate the public tree as well: the sidebar, mega
    // menu and tab wizard all render from it, so an alias or a deactivation has
    // to show up on the storefront without a hard refresh.
    saveTaxonomyNode: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/taxonomy/${id}`, body),
      onSuccess: invalidateContent('taxonomy'),
    }),
    deleteTaxonomyNode: useMutation({
      mutationFn: (id) => api.delete(`/admin/taxonomy/${id}`),
      onSuccess: invalidateContent('taxonomy'),
    }),

    createInvoiceRule: useMutation({
      mutationFn: (body) => api.post('/admin/invoice-rules', body),
      onSuccess: invalidate,
    }),
    saveInvoiceRule: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/admin/invoice-rules/${id}`, body),
      onSuccess: invalidate,
    }),
    deleteInvoiceRule: useMutation({
      mutationFn: (id) => api.delete(`/admin/invoice-rules/${id}`),
      onSuccess: invalidate,
    }),
    saveCommunications: useMutation({
      mutationFn: (body) => api.patch('/admin/settings/communications', body),
      onSuccess: invalidate,
    }),
    runInvoiceRules: useMutation({
      mutationFn: (dryRun) => api.post(`/admin/invoice-rules/run?dryRun=${dryRun ? 'true' : 'false'}`),
      onSuccess: invalidate,
    }),
  };
}
