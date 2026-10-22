'use client';

import { useSyncExternalStore } from 'react';

import { MOMENT_STATUSES, VENDOR_TYPES, type RunSheet } from './run-sheets';

/**
 * The run sheets saved this visit, by client (each starts empty), and
 * the supplier types and moment statuses the MC has added to the usual
 * ones. One
 * store for the whole preview, so Home's next-event row and the client's
 * Documents open the same sheet and an edit in one shows in the other.
 * Nothing persists past a reload: this is the review mock.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-store
 */

const sheets = new Map<string, RunSheet>();
let vendorTypes: string[] = VENDOR_TYPES;
let statuses: string[] = MOMENT_STATUSES;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * A client's sheet. The default is made once and kept, so the snapshot
 * stays the same object between renders (a fresh one each read would
 * make `useSyncExternalStore` loop).
 */
function read(client: string): RunSheet {
  let s = sheets.get(client);
  if (!s) {
    s = { moments: [], status: 'draft', version: 1 };
    sheets.set(client, s);
  }
  return s;
}

/** A client's sheet as it stands now, outside React (for an action that finishes later). */
export const currentSheet = read;

/** A client's run sheet, kept current as it is saved anywhere. */
export function useRunSheet(client: string): RunSheet {
  return useSyncExternalStore(
    subscribe,
    () => read(client),
    () => read(client),
  );
}

/** The client was renamed on their profile: their sheet (kept by name) follows them. */
export function renameRunSheet(from: string, to: string) {
  const s = sheets.get(from);
  if (from === to || !s) return;
  sheets.delete(from);
  sheets.set(to, s);
  notify();
}

/** Saves a client's sheet; every view of it updates. */
export function saveRunSheet(client: string, sheet: RunSheet) {
  sheets.set(client, sheet);
  notify();
}

/** The supplier types on offer: the usual ones plus the MC's own. */
export function useVendorTypes(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => vendorTypes,
    () => vendorTypes,
  );
}

/** Adds `name` to `list` once; the list (new when it grew) and the name as kept (trimmed, or the existing match). */
function addTo(list: string[], name: string): [string[], string] {
  const clean = name.trim();
  const had = list.find((t) => t.toLowerCase() === clean.toLowerCase());
  return had ? [list, had] : [[...list, clean], clean];
}

/** Adds a supplier type, once; returns it as kept. */
export function addVendorType(name: string): string {
  const [next, kept] = addTo(vendorTypes, name);
  if (next !== vendorTypes) {
    vendorTypes = next;
    notify();
  }
  return kept;
}

/** The moment statuses on offer: the usual ones plus the MC's own. */
export function useStatuses(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => statuses,
    () => statuses,
  );
}

/** Adds a moment status, once; returns it as kept. */
export function addStatus(name: string): string {
  const [next, kept] = addTo(statuses, name);
  if (next !== statuses) {
    statuses = next;
    notify();
  }
  return kept;
}
