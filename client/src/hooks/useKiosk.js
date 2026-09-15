import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import api from '@/lib/api';

/**
 * The kiosk's own data layer.
 *
 * Separate from `useAdmin` because a kiosk is **not an admin session**. Nothing
 * here reads `useAuth` or gates on `canUseAdmin`: nobody is signed in at a
 * tablet, and the cookie says only that staff entered the shop PIN today.
 */

/** The lock and welcome screens. Public, so a locked tablet can draw itself. */
export function useKioskConfig() {
  return useQuery({
    queryKey: ['kiosk', 'config'],
    queryFn: () => api.get('/kiosk/config'),
    // A tablet runs for a whole day without a reload; the shop's own copy does
    // not change under it, and refetching on every focus is noise.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The device tree, behind the session.
 *
 * `enabled` is explicit because the questions cannot ask for it before the
 * tablet is unlocked - a 401 on the lock screen would flash an error at a
 * customer who has done nothing wrong.
 */
export function useKioskDevices(enabled) {
  return useQuery({
    queryKey: ['kiosk', 'devices'],
    queryFn: () => api.get('/kiosk/devices'),
    enabled: Boolean(enabled),
    staleTime: 60 * 60 * 1000,
  });
}

export function useKioskMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['kiosk'] });

  return {
    unlock: useMutation({
      mutationFn: (body) => api.post('/kiosk/unlock', body),
      onSuccess: invalidate,
    }),
    lock: useMutation({
      mutationFn: () => api.post('/kiosk/lock', {}),
      onSuccess: invalidate,
    }),
    checkIn: useMutation({
      mutationFn: (body) => api.post('/kiosk/check-in', body),
    }),
  };
}

/**
 * Read a line out loud.
 *
 * ## Why `SpeechSynthesis` and not a provider
 *
 * It is free, offline, and needs no credential on a tablet that may be running
 * on shop wifi. The voice is the device's own, which is the trade: it sounds
 * less natural than a paid service, and it costs nothing per check-in and
 * cannot fail because an API key expired.
 *
 * ## Why every call is defensive
 *
 * `speechSynthesis` is absent in some browsers, throws in others, and on iOS it
 * stays silent until a user gesture has unlocked audio. **None of that may
 * break a check-in.** Reading a question aloud is an aid, not the interface -
 * the question is on screen either way - so every failure here is swallowed and
 * the flow carries on.
 */
export function useSpeech(enabled) {
  const [supported, setSupported] = useState(false);
  const lastSpoken = useRef(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  // Never leave a voice talking to an empty room.
  useEffect(() => {
    if (!enabled && supported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Nothing to recover: the flow does not depend on this.
      }
    }
  }, [enabled, supported]);

  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // Unmounting; there is nobody left to tell.
      }
    },
    [],
  );

  const speak = useCallback(
    (text) => {
      if (!enabled || !supported || !text) return;
      // The same screen re-rendering must not restart the sentence.
      if (lastSpoken.current === text) return;
      lastSpoken.current = text;

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        // Slightly under default: a customer hearing a question for the first
        // time is not skimming it.
        utterance.rate = 0.95;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Swallowed on purpose - see the note above.
      }
    },
    [enabled, supported],
  );

  return { speak, supported };
}

export default useKioskConfig;
