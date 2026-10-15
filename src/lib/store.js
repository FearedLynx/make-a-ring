import { useEffect, useReducer, useRef } from 'preact/hooks';

/** Minimal global store with selector-based subscriptions. */
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  const get = () => state;
  const set = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    subs.forEach((fn) => fn(state));
  };
  const subscribe = (fn) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };
  function use(selector = (s) => s) {
    const [, force] = useReducer((n) => n + 1, 0);
    const sel = useRef(selector);
    sel.current = selector;
    const value = selector(state);
    const last = useRef(value);
    last.current = value;
    useEffect(
      () =>
        subscribe((s) => {
          const v = sel.current(s);
          if (!Object.is(v, last.current)) force();
        }),
      []
    );
    return value;
  }
  return { get, set, subscribe, use };
}
