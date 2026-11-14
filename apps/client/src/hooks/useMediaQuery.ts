import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query. Returns false when matchMedia is missing
 * (jsdom, very old browsers), so callers fall back to the compact layout.
 */
export function useMediaQuery(query: string): boolean {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported) return () => undefined;

      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query, supported],
  );

  return useSyncExternalStore(
    subscribe,
    () => (supported ? window.matchMedia(query).matches : false),
    () => false,
  );
}
