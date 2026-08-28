import { createContext, useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const AuthContext = createContext(null);

/**
 * Session state. The token itself is an httpOnly cookie the JS never sees —
 * `/auth/me` is the only way to learn who is signed in.
 *
 * Three states matter across the whole UI:
 *   guest     — prices hidden, "Login to view" gate on every card
 *   pending   — signed in, still gated, shown "your account is under review"
 *   approved  — full trade pricing and ordering
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    // `/auth/me` answers 200 with `user: null` for a guest, so there is no 401 to
    // catch here — an error from this call is a real one and should surface.
    queryFn: () => api.get('/auth/me'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const user = data?.user ?? null;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    // Pricing is embedded in every product response, so the catalogue has to be
    // refetched whenever the viewer's approval state changes.
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['search'] });
    // Combo bundle prices are gated exactly like the catalogue.
    queryClient.invalidateQueries({ queryKey: ['offers'] });
  }, [queryClient]);

  const signIn = useCallback(
    async (credentials) => {
      const result = await api.post('/auth/login', credentials);
      queryClient.setQueryData(['auth', 'me'], { user: result.user });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      // Combo bundle prices are gated exactly like the catalogue.
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      return result.user;
    },
    [queryClient],
  );

  const signUp = useCallback((payload) => api.post('/auth/register', payload), []);

  const signOut = useCallback(async () => {
    await api.post('/auth/logout');
    queryClient.setQueryData(['auth', 'me'], { user: null });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['search'] });
    // Combo bundle prices are gated exactly like the catalogue.
    queryClient.invalidateQueries({ queryKey: ['offers'] });
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isApproved: user?.status === 'approved',
      isPending: user?.status === 'pending',
      isAdmin: user?.role === 'admin',
      // Panel access. An admin always has it; a staff member has it only once
      // an administrator has granted a role — access is granted, never
      // inherited (§7.6). The server decides for real; this only shapes the UI.
      isStaff: user?.role === 'staff',
      canUseAdmin: user?.role === 'admin' || (user?.role === 'staff' && Boolean(user?.staffRole)),
      // Area permissions, or null for an admin — who bypasses the map entirely.
      permissions: user?.permissions ?? null,
      signIn,
      signUp,
      signOut,
      refresh,
    }),
    [user, isLoading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Signing out from inside /account or /admin would otherwise leave the viewer
 * staring at that area's own access wall, so it always drops back to the shop.
 */
export function useSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return useCallback(async () => {
    await signOut();
    navigate('/');
  }, [signOut, navigate]);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

export default useAuth;
