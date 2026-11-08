// Styrbar matchMedia-mock for jsdom (kun tester).

type Listener = (event: MediaQueryListEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const matches = new Map<string, boolean>();

function createList(query: string): MediaQueryList {
  const set = listeners.get(query) ?? new Set<Listener>();
  listeners.set(query, set);
  const list = {
    media: query,
    get matches() {
      return matches.get(query) ?? false;
    },
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => set.add(listener),
    removeEventListener: (_type: string, listener: Listener) => set.delete(listener),
    addListener: (listener: Listener) => set.add(listener),
    removeListener: (listener: Listener) => set.delete(listener),
    dispatchEvent: () => true,
  };
  return list as unknown as MediaQueryList;
}

export function installMatchMedia(): void {
  window.matchMedia = (query: string) => createList(query);
}

/** Setter om en media query matcher, og varsler lyttere (som nettleseren gjør). */
export function setMediaQuery(query: string, value: boolean): void {
  matches.set(query, value);
  for (const listener of listeners.get(query) ?? []) {
    listener({ matches: value, media: query } as MediaQueryListEvent);
  }
}

export function resetMatchMedia(): void {
  matches.clear();
  listeners.clear();
}
