import { useSyncExternalStore } from 'react';

import type { Account } from '../../account';
import { ENGINE_DESIGNS, type EngineDesignKind } from '../../doc-builder/doc-types/designed';
import type { DocLayout } from '../../doc-builder/model/types';
import type { CanvasDoc } from '../model';

import { SPECS } from './registry';
import type { DesignKind } from './spec';

/**
 * The MC's design for each kind of document, and which design is open in
 * the editor. One design per kind, shared by every document of that kind
 * (as the brand kit is shared by all): Zebri's default layout until the
 * MC changes it. Held for the visit, as the rest of the preview's data is.
 * The questionnaire, contract and invoice are designed on the document
 * engine (a stack of sections, `doc-builder/doc-types/designed.ts`), the
 * rest still on the canvas; both are kept here.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/design-store
 */

const saved = new Map<DesignKind, CanvasDoc>();
const layouts = new Map<EngineDesignKind, DocLayout>();
/** Kinds the MC has saved a design for; the rest still wear the classic page (see `useCustomised`). */
const customised = new Set<DesignKind>();
/** What the editor has open: a kind, and the real data to design with (or the sample). */
let open: { kind: DesignKind; data: unknown } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The design for `kind`: the MC's, else Zebri's default. */
export function designOf(kind: DesignKind): CanvasDoc {
  let doc = saved.get(kind);
  if (!doc) {
    doc = SPECS[kind].layout();
    saved.set(kind, doc);
  }
  return doc;
}

/** Saves the MC's design for `kind`. */
export function saveDesign(kind: DesignKind, doc: CanvasDoc) {
  saved.set(kind, doc);
  customised.add(kind);
  emit();
}

/** The design for `kind`, kept current. */
export function useDesign(kind: DesignKind): CanvasDoc {
  return useSyncExternalStore(subscribe, () => designOf(kind), () => designOf(kind));
}

/**
 * Whether the MC has saved their own design for `kind`. Until they have,
 * contracts and invoices show the classic page they were first built as
 * (founder, 2026-10-08: the canvas default did not look like it).
 */
export function useCustomised(kind: DesignKind): boolean {
  return useSyncExternalStore(subscribe, () => customised.has(kind), () => false);
}

/** The engine design for `kind`: the MC's, else Zebri's starter for their business. */
export function layoutOf(kind: EngineDesignKind, account: Account): DocLayout {
  let layout = layouts.get(kind);
  if (!layout) {
    layout = ENGINE_DESIGNS[kind].starter(account);
    layouts.set(kind, layout);
  }
  return layout;
}

/** Saves the MC's engine design for `kind`. */
export function saveLayout(kind: EngineDesignKind, layout: DocLayout) {
  layouts.set(kind, layout);
  customised.add(kind);
  emit();
}

/** Drops the MC's engine design for `kind` (Reset): Zebri's starter, and the classic page, again. */
export function resetLayout(kind: EngineDesignKind) {
  layouts.delete(kind);
  customised.delete(kind);
  emit();
}

/** The engine design for `kind`, kept current. */
export function useLayout(kind: EngineDesignKind, account: Account): DocLayout {
  return useSyncExternalStore(subscribe, () => layoutOf(kind, account), () => layoutOf(kind, account));
}

/** Whether the MC has saved their own design for `kind`, read once (not kept current). */
export const isCustomised = (kind: DesignKind) => customised.has(kind);

/** Opens the design editor for `kind`, with this document's data (or the sample when left out). */
export function openDesign(kind: DesignKind, data?: unknown) {
  open = { kind, data };
  emit();
}

/** Closes the design editor. */
export function closeDesign() {
  open = null;
  emit();
}

/** What the design editor has open. */
export function useOpenDesign() {
  return useSyncExternalStore(subscribe, () => open, () => null);
}

/**
 * Whether a design is open. A modal dialog that holds a Design button
 * steps aside while it is (its `open` and this): the engine's editor is a
 * layer on the page (`DocShell`), which a modal in the browser's top
 * layer would cover. It comes back as it was when the design closes.
 */
export const useDesigning = () => useOpenDesign() !== null;
