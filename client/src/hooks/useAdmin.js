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
  const { isAdmin } = useAuth();
  const params = {};
  if (range?.from) params.from = range.from;
  if (range?.to) params.to = range.to;

  return useQuery({
    queryKey: ['admin', 'stats', params],
    queryFn: () => api.get('/admin/stats', params),
    enabled: isAdmin,
    staleTime: 30 * 1000,
  });
}

export function useAdminUsers(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get('/admin/users', params),
    enabled: isAdmin,
    staleTime: 15 * 1000,
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
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: () => api.get('/admin/products', params),
    enabled: isAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminOrders(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: () => api.get('/admin/orders', params),
    enabled: isAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminBlog(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'blog', params],
    queryFn: () => api.get('/admin/blog', params),
    enabled: isAdmin,
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
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'faqs', params],
    queryFn: () => api.get('/admin/faqs', params),
    enabled: isAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminOffers(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'offers', params],
    queryFn: () => api.get('/admin/offers', params),
    enabled: isAdmin,
    staleTime: 15 * 1000,
  });
}

export function useAdminInvoices(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'invoices', params],
    queryFn: () => api.get('/admin/invoices', params),
    enabled: isAdmin,
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
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'suppliers', params],
    queryFn: () => api.get('/admin/suppliers', params),
    enabled: isAdmin,
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

export function useAdminPurchaseOrders(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'purchase-orders', params],
    queryFn: () => api.get('/admin/purchase-orders', params),
    enabled: isAdmin,
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
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'expenses', params],
    queryFn: () => api.get('/admin/expenses', params),
    enabled: isAdmin,
    staleTime: 15 * 1000,
  });
}

/** Categories carry their usage count, so the UI can explain a refused delete
 *  before the operator clicks it rather than after. */
export function useAdminExpenseCategories() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'expense-categories'],
    queryFn: () => api.get('/admin/expenses/categories'),
    enabled: isAdmin,
    staleTime: 60 * 1000,
  });
}

/**
 * `enabled` is explicit because the purchase-order form needs the whole
 * catalogue to populate its product picker and nothing else on that screen
 * does — fetching 400+ rows to render a list of purchase orders is waste.
 */
export function useAdminInventory(params, enabled = true) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'inventory', params],
    queryFn: () => api.get('/admin/inventory', params),
    enabled: isAdmin && enabled,
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

export function useAdminQuotes(params) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'quotes', params],
    queryFn: () => api.get('/admin/quotes', params),
    enabled: isAdmin,
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
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'rma', params],
    queryFn: () => api.get('/admin/rma', params),
    enabled: isAdmin,
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
  const { isAdmin } = useAuth();
  const params = { ...extra };
  if (range?.from) params.from = range.from;
  if (range?.to) params.to = range.to;

  return useQuery({
    queryKey: ['admin', 'reports', tab, params],
    queryFn: () => api.get(`/admin/reports/${tab}`, params),
    enabled: isAdmin && Boolean(tab),
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

    recordInvoicePayment: useMutation({
      mutationFn: ({ number, ...body }) => api.post(`/admin/invoices/${number}/payments`, body),
      onSuccess: invalidate,
    }),
    voidInvoice: useMutation({
      mutationFn: ({ number, reason }) => api.post(`/admin/invoices/${number}/void`, { reason }),
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
  };
}
