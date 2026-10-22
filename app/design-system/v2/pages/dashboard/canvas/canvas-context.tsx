'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { BrandKit } from '../brand/kit';

/**
 * What a canvas document needs from the document it shows, beyond its
 * elements: the brand kit to resolve against, the words Zebri fills into
 * its fields (an invoice's total, the couple's names), the working parts
 * a client's page carries (packages to pick, Pay deposit), and the MC's
 * business name for a logo slot with no logo yet. The editor and the
 * read-only page both provide it.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/canvas-context
 */

export interface CanvasData {
  kit: BrandKit;
  /** Field values by name: `{ 'invoice.total': '$1,088.00' }`. */
  fields: Record<string, string>;
  /** What each field is, for the Text tab: `{ 'invoice.total': 'Total' }`. Unnamed fields are not offered. */
  fieldNames?: Record<string, string> | undefined;
  /** Working parts by name, each drawn at its element's size. */
  widgets: Record<string, (size: { w: number; h: number }) => ReactNode>;
  business: string;
}

const Context = createContext<CanvasData | null>(null);

/** Provides a document's data to its canvas. */
export function CanvasDataProvider({ value, children }: { value: CanvasData; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The canvas's data; a canvas is always drawn inside a provider. */
export function useCanvasData(): CanvasData {
  const v = useContext(Context);
  if (!v) throw new Error('A canvas must be drawn inside CanvasDataProvider');
  return v;
}
