'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { FLOATING_BAR } from '@/components/ui-v2/control-styles';
import { MinusIcon, PlusIcon } from '@/components/ui-v2/icons';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { CanvasDataProvider, type CanvasData } from './canvas-context';
import { PageView } from './page-view';
import { Rail } from './rail/rail';
import { ContextToolbar } from './toolbar/context-toolbar';
import type { Canvas } from './use-canvas';
import { useCanvasKeys } from './use-canvas-keys';

/**
 * The shared Canva-style editor every Zebri document opens in: the rail
 * of tools on the left, the pages on the grey desk in the middle,
 * scaled to fit the desk's width (or zoomed by hand), the context toolbar
 * floating over the top of the desk, and the zoom control in the
 * desk's corner. The document's own data (fields, working parts, the
 * brand kit) comes in as `data`; the editor owns no document state, so
 * the document's dialog can save or send `canvas.doc` when it likes.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/canvas-editor
 */

export interface CanvasEditorProps {
  canvas: Canvas;
  data: CanvasData;
  /** The element being typed into, held by the caller so the toolbar can see it. */
  editing: string | null;
  onEditing: (id: string | null) => void;
}

/** Zoom steps the − and + buttons move between. */
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];

/** The editor. See {@link CanvasEditorProps}. */
export function CanvasEditor({ canvas, data, editing, onEditing }: CanvasEditorProps) {
  const desk = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.75);
  const [zoom, setZoom] = useState<number | null>(null);
  const widest = Math.max(...canvas.doc.pages.map((p) => p.width));
  useLayoutEffect(() => {
    const el = desk.current;
    if (!el) return;
    // Fit the widest page to the desk with room either side, never past full size.
    const measure = () => setFit(Math.min(1, (el.clientWidth - 96) / widest));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widest]);
  useCanvasKeys(canvas, editing === null);
  // Every brand face the kit can pick, so a font change shows at once.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  const z = zoom ?? fit;
  /** The page a click in the rail adds to: the picked element's, else the one nearest the middle of the desk. */
  const target = () => {
    const { pages } = canvas.doc;
    const picked = pages.find((p) => p.elements.some((e) => canvas.selected.includes(e.id)));
    const el = desk.current;
    if (picked || !el) return picked ?? pages[0]!;
    const mid = el.getBoundingClientRect().top + el.clientHeight / 2;
    const dist = (p: (typeof pages)[number]) => {
      const r = el.querySelector(`[data-page="${p.id}"]`)?.getBoundingClientRect();
      return r ? Math.abs(r.top + r.height / 2 - mid) : Infinity;
    };
    return pages.reduce((best, p) => (dist(p) < dist(best) ? p : best), pages[0]!);
  };
  const stepTo = (dir: 1 | -1) => {
    const next = dir === 1 ? STEPS.find((s) => s > z + 0.001) : [...STEPS].reverse().find((s) => s < z - 0.001);
    if (next) setZoom(next);
  };
  return (
    <CanvasDataProvider value={data}>
      <div className="flex min-h-0 flex-1">
        <Rail canvas={canvas} target={target} />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div ref={desk} className="min-h-0 flex-1 overflow-auto bg-zebra-50">
            <div className="flex min-w-max flex-col items-center gap-8 px-12 pb-10 pt-20" onPointerDown={(e) => {
                if (e.target !== e.currentTarget) return;
                canvas.select([]);
                onEditing(null);
              }}>
              {canvas.doc.pages.map((p) => (
                <PageView key={p.id} page={p} canvas={canvas} zoom={z} editing={editing} onEditing={onEditing} />
              ))}
            </div>
          </div>
          <ContextToolbar canvas={canvas} />
          <div className={`absolute bottom-4 right-4 ${FLOATING_BAR}`}>
            <Button variant="ghost" square aria-label="Zoom out" onClick={() => stepTo(-1)}>
              <MinusIcon aria-hidden="true" className="size-4" />
            </Button>
            <Button variant="ghost" onClick={() => setZoom(null)} aria-label="Zoom to fit">
              <span className="w-10 type-numeric">{Math.round(z * 100)}%</span>
            </Button>
            <Button variant="ghost" square aria-label="Zoom in" onClick={() => stepTo(1)}>
              <PlusIcon aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </CanvasDataProvider>
  );
}
