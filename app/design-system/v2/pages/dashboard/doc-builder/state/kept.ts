/**
 * A small keyed store, held in memory and mirrored to this browser's
 * storage, for what the preview keeps between visits (drafts, edited
 * templates, sent proposals). The preview has no server; storage can be
 * missing, blocked or full, and then memory alone serves for the visit.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/state/kept
 */

/** One store under one storage key. */
export interface Kept<T> {
  read: (id: string) => T | null;
  write: (id: string, value: T) => void;
  remove: (id: string) => void;
  /** Every kept value, oldest first. */
  all: () => T[];
  /** Calls `fn` after every write or removal; returns the unsubscribe (for `useSyncExternalStore`). */
  subscribe: (fn: () => void) => () => void;
}

/** The store saved under `storageKey`. */
export function kept<T>(storageKey: string): Kept<T> {
  const memory = new Map<string, T>();
  const listeners = new Set<() => void>();
  let loaded = false;
  // Read the browser's copy once, on first use (never during server render).
  const load = () => {
    if (loaded) return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, T>)) memory.set(k, v);
    } catch {
      // Blocked or corrupt storage: start from memory.
    }
  };
  const persist = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(memory)));
    } catch {
      // Full or blocked: it still lives in memory for this visit.
    }
    for (const fn of listeners) fn();
  };
  return {
    read: (id) => (load(), memory.get(id) ?? null),
    write: (id, value) => (load(), memory.set(id, value), persist()),
    remove: (id) => (load(), memory.delete(id), persist()),
    all: () => (load(), [...memory.values()]),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
