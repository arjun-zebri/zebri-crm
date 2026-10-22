'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChevronLeftIcon, LayoutTemplateIcon, PaletteIcon, ShapesIcon, TypeIcon, UploadIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { RailTab } from '@/components/ui-v2/rail-tab';

import type { CanvasPage } from '../model';
import { useStyle } from '../toolbar/use-style';
import type { Canvas } from '../use-canvas';

import type { RailApi } from './api';
import { BrandPanel } from './brand-panel';
import { DesignPanel } from './design-panel';
import { setDragged } from './drag';
import { ElementsPanel } from './elements-panel';
import { DRAG_TYPE, place } from './presets';
import { TextPanel } from './text-panel';
import { UploadsPanel, type Upload } from './uploads-panel';

/**
 * The editor's left rail, as Canva's: five tabs (Design, Elements, Text,
 * Brand, Uploads), each opening its panel beside the rail; pressing the
 * open tab again, or the panel's chevron, folds the panel away and gives
 * the pages the room. Whatever a panel adds lands on the page in view
 * (`target`), or where it is dropped.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/rail
 */

type Tab = 'design' | 'elements' | 'text' | 'brand' | 'uploads';

const TABS: { id: Tab; label: string; icon: ZebriIcon }[] = [
  { id: 'design', label: 'Design', icon: LayoutTemplateIcon },
  { id: 'elements', label: 'Elements', icon: ShapesIcon },
  { id: 'text', label: 'Text', icon: TypeIcon },
  { id: 'brand', label: 'Brand', icon: PaletteIcon },
  { id: 'uploads', label: 'Uploads', icon: UploadIcon },
];

export interface RailProps {
  canvas: Canvas;
  /** The page in view, where a click adds. */
  target: () => CanvasPage;
}

/** The rail. See {@link RailProps}. */
export function Rail({ canvas, target }: RailProps) {
  // Open beside the pages on a wide screen; on a phone it starts folded and opens over them.
  const [tab, setTab] = useState<Tab | null>(() => (window.matchMedia('(min-width: 768px)').matches ? 'elements' : null));
  const [uploads, setUploads] = useState<Upload[]>([]);
  const style = useStyle(canvas);
  const api: RailApi = {
    canvas,
    style,
    add: (el) => {
      const page = target();
      canvas.add(page.id, place(el, page));
    },
    drag: (make) => ({
      onDragStart: (e) => {
        setDragged(make());
        e.dataTransfer.setData(DRAG_TYPE, '1');
        e.dataTransfer.effectAllowed = 'copy';
      },
      onDragEnd: () => setDragged(null),
    }),
  };
  const open = TABS.find((t) => t.id === tab);
  return (
    <div className="relative flex shrink-0 bg-field">
      <nav aria-label="Tools" className="flex w-20 flex-col items-center gap-1 py-3">
        {TABS.map((t) => (
          <RailTab key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={() => setTab(tab === t.id ? null : t.id)} />
        ))}
      </nav>
      {open ? (
        <section aria-label={open.label} className="flex w-72 flex-col bg-field max-md:absolute max-md:inset-y-0 max-md:left-20 max-md:z-20 max-md:shadow-lg">
          <div className="flex items-center justify-between gap-2 py-3 pl-1 pr-3">
            <h2 className="type-subheading text-zebra-950">{open.label}</h2>
            <Button variant="ghost" square aria-label="Fold away" onClick={() => setTab(null)}>
              <ChevronLeftIcon aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-6 pl-1 pr-4">
            {tab === 'design' ? <DesignPanel api={api} /> : null}
            {tab === 'elements' ? <ElementsPanel api={api} /> : null}
            {tab === 'text' ? <TextPanel api={api} /> : null}
            {tab === 'brand' ? <BrandPanel api={api} /> : null}
            {tab === 'uploads' ? <UploadsPanel api={api} uploads={uploads} onUpload={(u) => setUploads((list) => [u, ...list])} /> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
