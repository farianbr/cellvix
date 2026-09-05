import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * The supplier portal's session and data (§6.8a).
 *
 * Deliberately **not** part of `useAuth`. That context is the buyer/admin
 * session, and folding a supplier into it would mean every consumer of
 * `useAuth` — the header, the price gate, the cart, the admin shell — gained a
 * fourth kind of user it was never written to reason about. A supplier signs in
 * against a different cookie and a different collection on the server (see
 * `middleware/supplierAuth.js`); keeping the client split the same way is what
 * makes that separation visible rather than incidental.
 *
 * A plain hook rather than a provider: the portal is four screens, and the one
 * query below is cached by React Query anyway, so a context would add a
 * subscription boundary for nothing.
 */

const ME = ['supplier-portal', 'me'];

export function useSupplierSession() {
  const { data, isLoading } = useQuery({
    queryKey: ME,
    // Answers 200 with `supplier: null` when signed out, so there is no 401 to
    // swallow — an error here is a real one and should surface.
    queryFn: () => api.get('/supplier-portal/me'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    supplier: data?.supplier ?? null,
    isLoading,
    isAuthenticated: Boolean(data?.supplier),
  };
}

export function useSupplierRfqs() {
  const { isAuthenticated } = useSupplierSession();
  return useQuery({
    queryKey: ['supplier-portal', 'rfqs'],
    queryFn: () => api.get('/supplier-portal/rfqs'),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

/**
 * One request.
 *
 * Fetching it marks the invite `viewed` server-side, which is why this is not
 * prefetched with the list: "opened it and has not answered" is a fact the
 * purchasing team acts on, and it would stop being true if merely loading the
 * dashboard marked every request read.
 */
export function useSupplierRfq(id) {
  return useQuery({
    queryKey: ['supplier-portal', 'rfqs', id],
    queryFn: () => api.get(`/supplier-portal/rfqs/${id}`),
    enabled: Boolean(id),
  });
}

export function useSupplierPortalMutations() {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['supplier-portal'] });

  return {
    signIn: useMutation({
      mutationFn: (body) => api.post('/supplier-portal/login', body),
      onSuccess: (result) => {
        queryClient.setQueryData(ME, { supplier: result.supplier });
        invalidate();
      },
    }),
    signOut: useMutation({
      mutationFn: () => api.post('/supplier-portal/logout', {}),
      onSuccess: () => {
        queryClient.setQueryData(ME, { supplier: null });
        // Cleared rather than refetched: the next supplier to sign in on this
        // browser must not see the previous one's requests for even a frame.
        queryClient.removeQueries({ queryKey: ['supplier-portal', 'rfqs'] });
      },
    }),
    forgotPassword: useMutation({
      mutationFn: (body) => api.post('/supplier-portal/forgot-password', body),
    }),
    resetPassword: useMutation({
      mutationFn: (body) => api.post('/supplier-portal/reset-password', body),
    }),
    changePassword: useMutation({
      mutationFn: (body) => api.post('/supplier-portal/password', body),
    }),
    submitQuote: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/supplier-portal/rfqs/${id}/quote`, body),
      onSuccess: invalidate,
    }),
    declineQuote: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/supplier-portal/rfqs/${id}/decline`, body),
      onSuccess: invalidate,
    }),
  };
}
