import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * Blog, FAQ and offers.
 *
 * All three are editorial: they change a few times a week at most, so they carry
 * a long `staleTime` and never refetch on focus. The offers query is the one
 * exception that matters — it is keyed on whether the viewer can see pricing, so
 * signing in swaps a gated bundle price for a real one without a manual refetch.
 */

const FIVE_MINUTES = 5 * 60 * 1000;

export function useBlogPosts(params = {}) {
  return useQuery({
    queryKey: ['blog', params],
    queryFn: () => api.get('/blog', params),
    staleTime: FIVE_MINUTES,
    placeholderData: (previous) => previous,
  });
}

export function useBlogPost(slug) {
  return useQuery({
    queryKey: ['blog', 'post', slug],
    queryFn: () => api.get(`/blog/${slug}`),
    enabled: Boolean(slug),
    staleTime: FIVE_MINUTES,
    retry: false,
  });
}

export function useFaqs(params = {}) {
  return useQuery({
    queryKey: ['faq', params],
    queryFn: () => api.get('/faq', params),
    staleTime: FIVE_MINUTES,
  });
}

export function useOffers(priceVisible = false) {
  return useQuery({
    // Pricing is part of the key: the same URL returns a gated payload to a
    // guest and a priced one to an approved buyer.
    queryKey: ['offers', { priceVisible }],
    queryFn: () => api.get('/offers'),
    staleTime: FIVE_MINUTES,
  });
}
