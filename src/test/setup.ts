import "@testing-library/jest-dom";

// jsdom 20 + vitest 3: window.localStorage/sessionStorage มาเป็น object เปล่า ไม่มีเมธอด
// เติม in-memory Storage ให้ครบเฉพาะเมื่อของจริงใช้ไม่ได้
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as Storage;
}

if (typeof window !== "undefined") {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    const current = window[name] as Storage | undefined;
    if (!current || typeof current.setItem !== "function") {
      Object.defineProperty(window, name, { value: createMemoryStorage(), writable: true });
      Object.defineProperty(globalThis, name, { value: window[name], writable: true });
    }
  }
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
