'use client';

import { useSyncExternalStore } from 'react';

import { CEREMONY_SCRIPT_ID, newScript, type Script } from './scripts-data';

/**
 * The scripts saved this visit, by client. Every client starts with one
 * empty ceremony script, so there is always one to open from their
 * Documents; New document > Script adds another. One store for the
 * preview, so every view of a script shows the same words. Nothing
 * persists past a reload: this is the review mock.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-store
 */

const scripts = new Map<string, Script[]>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** A client's scripts, made once and kept so the snapshot holds still between renders. */
function read(client: string): Script[] {
  let list = scripts.get(client);
  if (!list) {
    list = [newScript(CEREMONY_SCRIPT_ID)];
    scripts.set(client, list);
  }
  return list;
}

/** A client's scripts, kept current as any is saved. */
export function useScripts(client: string): Script[] {
  return useSyncExternalStore(
    subscribe,
    () => read(client),
    () => read(client),
  );
}

/**
 * Changes one of a client's scripts; every view of it updates. Patches
 * the script as it stands now, not as the caller last saw it, so the
 * editor's save (made once, when the editor was) never undoes a rename.
 */
export function patchScript(client: string, id: string, patch: Partial<Script>) {
  scripts.set(
    client,
    read(client).map((s) => (s.id === id ? { ...s, ...patch } : s)),
  );
  notify();
}

/** Adds an empty script for a client and returns it. */
export function addScript(client: string): Script {
  const script = newScript();
  scripts.set(client, [...read(client), script]);
  notify();
  return script;
}
