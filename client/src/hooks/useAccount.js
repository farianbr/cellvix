import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** Dashboard payload: recent orders, credit, invoice totals, quick reorder. */
export function useAccountSummary() {
  const { isApproved } = useAuth();
  return useQuery({
    queryKey: ['account', 'summary'],
    queryFn: () => api.get('/account/summary'),
    enabled: isApproved,
    staleTime: 60 * 1000,
  });
}

export function useOrders() {
  const { isApproved } = useAuth();
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders'),
    enabled: isApproved,
    select: (payload) => payload.orders,
    staleTime: 60 * 1000,
  });
}

export function useOrder(orderNumber) {
  return useQuery({
    queryKey: ['orders', orderNumber],
    queryFn: () => api.get(`/orders/${orderNumber}`),
    select: (payload) => payload.order,
    enabled: Boolean(orderNumber),
  });
}

export function useInvoices() {
  const { isApproved } = useAuth();
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices'),
    enabled: isApproved,
    staleTime: 60 * 1000,
  });
}

/**
 * The store-credit statement: balance plus the movements behind it.
 *
 * Separate query from the account summary, which carries only the balance — the
 * statement is a page, the balance is a number several pages want.
 */
export function useStoreCredit() {
  const { isApproved } = useAuth();
  return useQuery({
    queryKey: ['store-credit'],
    queryFn: () => api.get('/account/store-credit'),
    enabled: isApproved,
    staleTime: 30 * 1000,
  });
}

export function useSavedCarts() {
  const { isApproved } = useAuth();
  return useQuery({
    queryKey: ['cart', 'saved'],
    queryFn: () => api.get('/cart/saved'),
    enabled: isApproved,
    select: (payload) => payload.carts,
  });
}

/**
 * Account mutations.
 *
 * Every one of these returns the updated user, so they all write straight into
 * the auth cache — the header, checkout autofill and address list stay in step
 * without a refetch round-trip.
 */
export function useAccountMutations() {
  const queryClient = useQueryClient();

  const writeUser = (payload) => {
    if (payload?.user) queryClient.setQueryData(['auth', 'me'], { user: payload.user });
    queryClient.invalidateQueries({ queryKey: ['account', 'summary'] });
  };

  return {
    updateProfile: useMutation({
      mutationFn: (data) => api.patch('/account/profile', data),
      onSuccess: writeUser,
    }),
    addAddress: useMutation({
      mutationFn: (data) => api.post('/account/addresses', data),
      onSuccess: writeUser,
    }),
    updateAddress: useMutation({
      mutationFn: ({ id, ...data }) => api.patch(`/account/addresses/${id}`, data),
      onSuccess: writeUser,
    }),
    removeAddress: useMutation({
      mutationFn: (id) => api.delete(`/account/addresses/${id}`),
      onSuccess: writeUser,
    }),
    addPaymentMethod: useMutation({
      mutationFn: (data) => api.post('/account/payment-methods', data),
      onSuccess: writeUser,
    }),
    removePaymentMethod: useMutation({
      mutationFn: (id) => api.delete(`/account/payment-methods/${id}`),
      onSuccess: writeUser,
    }),
    changePassword: useMutation({
      mutationFn: (data) => api.post('/account/password', data),
    }),
    rechargeStoreCredit: useMutation({
      mutationFn: (data) => api.post('/account/store-credit/recharge', data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['store-credit'] });
        queryClient.invalidateQueries({ queryKey: ['account', 'summary'] });
        // The checkout quote carries what credit can cover, so it is stale now.
        queryClient.invalidateQueries({ queryKey: ['quote'] });
      },
    }),
    bulkAdd: useMutation({
      mutationFn: (lines) => api.post('/cart/bulk', { lines }),
      onSuccess: (payload) => {
        queryClient.setQueryData(['cart'], { cart: payload.cart });
      },
    }),
    restoreSavedCart: useMutation({
      mutationFn: (id) => api.post(`/cart/saved/${id}/restore`),
      onSuccess: (payload) => {
        queryClient.setQueryData(['cart'], { cart: payload.cart });
        queryClient.invalidateQueries({ queryKey: ['cart', 'saved'] });
        queryClient.invalidateQueries({ queryKey: ['account', 'summary'] });
      },
    }),
    deleteSavedCart: useMutation({
      mutationFn: (id) => api.delete(`/cart/saved/${id}`),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['cart', 'saved'] });
        queryClient.invalidateQueries({ queryKey: ['account', 'summary'] });
      },
    }),
  };
}
