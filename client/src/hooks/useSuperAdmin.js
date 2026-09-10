import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * The super-admin console's data layer (SAAS_PLATFORM §4.5).
 *
 * **Its own query-key namespace**, kept clear of `['admin']` and
 * `['supplier-portal']`. The three sessions are separate on the server and the
 * cache follows: signing out of one must not drop another's data, and an
 * `invalidateQueries({ queryKey: ['admin'] })` from the business switcher has
 * no business touching the console.
 */

const ME = ['superadmin', 'me'];

export function useSuperAdminSession() {
  const { data, isLoading } = useQuery({
    queryKey: ME,
    // Answers 200 with `admin: null` when signed out, so there is no 401 to
    // catch — an error here is a real one and should surface.
    queryFn: () => api.get('/superadmin/me'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    admin: data?.admin ?? null,
    isLoading,
    isAuthenticated: Boolean(data?.admin),
  };
}

export function useTenants() {
  const { isAuthenticated } = useSuperAdminSession();
  return useQuery({
    queryKey: ['superadmin', 'tenants'],
    queryFn: () => api.get('/superadmin/tenants'),
    enabled: isAuthenticated,
    staleTime: 15 * 1000,
  });
}

export function usePlans() {
  const { isAuthenticated } = useSuperAdminSession();
  return useQuery({
    queryKey: ['superadmin', 'plans'],
    queryFn: () => api.get('/superadmin/plans'),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

/** One business's feature grid — every key, its answer, and where it came from. */
export function useBusinessFeatures(businessId) {
  return useQuery({
    queryKey: ['superadmin', 'businesses', businessId, 'features'],
    queryFn: () => api.get(`/superadmin/businesses/${businessId}/features`),
    enabled: Boolean(businessId),
  });
}

export function useSuperAdminMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['superadmin'] });

  return {
    signIn: useMutation({
      mutationFn: (body) => api.post('/superadmin/login', body),
      onSuccess: (result) => {
        queryClient.setQueryData(ME, { admin: result.admin });
        invalidate();
      },
    }),
    signOut: useMutation({
      mutationFn: () => api.post('/superadmin/logout', {}),
      onSuccess: () => {
        queryClient.setQueryData(ME, { admin: null });
        // Cleared rather than refetched: the next operator to sign in on this
        // browser must not see the previous one's tenants for even a frame.
        queryClient.removeQueries({ queryKey: ['superadmin', 'tenants'] });
      },
    }),

    createTenant: useMutation({
      mutationFn: (body) => api.post('/superadmin/tenants', body),
      onSuccess: invalidate,
    }),
    updateTenant: useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`/superadmin/tenants/${id}`, body),
      onSuccess: invalidate,
    }),
    setSlots: useMutation({
      mutationFn: ({ id, slots }) => api.patch(`/superadmin/tenants/${id}/slots`, { slots }),
      onSuccess: invalidate,
    }),
    createBusiness: useMutation({
      mutationFn: ({ id, ...body }) => api.post(`/superadmin/tenants/${id}/businesses`, body),
      onSuccess: invalidate,
    }),
    assignBusiness: useMutation({
      mutationFn: ({ id, tenant }) =>
        api.patch(`/superadmin/businesses/${id}/tenant`, { tenant }),
      onSuccess: invalidate,
    }),

    /**
     * `enabled: null` clears the override rather than switching the feature
     * off — a different act, and the only way back to a plan or type default.
     */
    setFeature: useMutation({
      mutationFn: ({ id, key, enabled }) =>
        api.patch(`/superadmin/businesses/${id}/features`, { key, enabled }),
      onSuccess: invalidate,
    }),

    createPlan: useMutation({
      mutationFn: (body) => api.post('/superadmin/plans', body),
      onSuccess: invalidate,
    }),
  };
}
