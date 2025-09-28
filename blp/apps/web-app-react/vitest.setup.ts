import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  // @ts-expect-error - assignment to global for tests
  globalThis.ResizeObserver = ResizeObserverMock;
}

if (!crypto.randomUUID) {
  crypto.randomUUID = () => Math.random().toString(36).slice(2);
}
