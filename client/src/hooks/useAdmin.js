import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export function useAdminStats() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats'),
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
  };
}
