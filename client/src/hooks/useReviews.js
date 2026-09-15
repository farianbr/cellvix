import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

/**
 * What this buyer may still review.
 *
 * One entry per ORDER LINE, not per product: the same screen bought twice is
 * two reviews to write, and each carries the order it belongs to.
 *
 * `orderId` narrows it to a single order, which is what the Thank You page asks
 * for. Without it the account's orders page gets every outstanding line.
 */
export function usePendingReviews(orderId) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['reviews', 'pending', orderId ?? 'all'],
    queryFn: () => api.get('/reviews/pending', orderId ? { orderId } : undefined),
    select: (payload) => payload.pending ?? [],
    // A guest has nothing pending and the endpoint would 401. The Thank You
    // page is reachable straight after checkout, so this runs there.
    enabled: isAuthenticated,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body) => api.post('/reviews', body),
    onSuccess: (_data, variables) => {
      // The pending list shrinks by one, and the product page it was written
      // about now has a review on it. Both are invalidated rather than patched:
      // the server decides the average, and a client that computed its own
      // would be a second opinion about the same number.
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      if (variables?.productId) {
        queryClient.invalidateQueries({ queryKey: ['reviews', 'product', variables.productId] });
      }
    },
  });
}

/** Public: the reviews on one product. */
export function useProductReviews(productId) {
  return useQuery({
    queryKey: ['reviews', 'product', productId],
    queryFn: () => api.get(`/reviews/product/${productId}`),
    enabled: Boolean(productId),
  });
}

export default usePendingReviews;
