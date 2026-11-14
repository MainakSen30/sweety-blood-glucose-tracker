import '@testing-library/jest-dom/vitest';

/**
 * jsdom has no IntersectionObserver, which Motion needs for whileInView.
 * Treat every observed element as already visible.
 */
class VisibleIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

globalThis.IntersectionObserver =
  VisibleIntersectionObserver as unknown as typeof IntersectionObserver;
