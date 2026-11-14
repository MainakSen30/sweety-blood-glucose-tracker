import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useReducedMotion } from 'motion/react';

/**
 * Window-level Lenis for the landing page only. Mounts one instance and
 * destroys it on unmount, so route changes never leave a second smoother
 * running. Reduced motion and missing ResizeObserver fall back to native scroll.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || typeof ResizeObserver === 'undefined') return;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: true });
    let frame = requestAnimationFrame(function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reduceMotion]);

  return <>{children}</>;
}
