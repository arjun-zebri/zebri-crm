'use client';

import { AddTile } from '@/components/ui-v2/add-tile';
import { ImageIcon } from '@/components/ui-v2/icons';


import { useCanvasData } from '../canvas-context';
import { colorOf } from '../resolve';

import type { RailApi } from './api';
import { imageOf, logoOf, SHAPES, type ShapeId } from './presets';

/**
 * The Elements tab: shapes in the brand colour (square, rounded, circle,
 * a full-width band, a line), an empty picture frame, and the logo slot.
 * Click adds to the page in view; drag places it.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/elements-panel
 */

const SHAPE_LABELS: Record<ShapeId, string> = { square: 'Square', rounded: 'Rounded square', circle: 'Circle', band: 'Band', line: 'Line' };

/** How each shape looks on its tile: classes for its outline, the colour comes from the kit. */
const SHAPE_TILE: Record<ShapeId, string> = {
  square: 'size-12',
  rounded: 'size-12 rounded-panel',
  circle: 'size-12 rounded-pill',
  band: 'h-5 w-16',
  line: 'h-px w-14',
};

/** The Elements tab. */
export function ElementsPanel({ api }: { api: RailApi }) {
  const { kit, business } = useCanvasData();
  const brand = colorOf('kit:primary', kit);
  return (
    <div className="space-y-6">
      <section aria-label="Shapes" className="space-y-2">
        <h3 className="type-label text-zebra-950">Shapes</h3>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SHAPES) as ShapeId[]).map((id) => (
            <AddTile key={id} label={`Add a ${SHAPE_LABELS[id].toLowerCase()}`} onAdd={() => api.add(SHAPES[id]())} {...api.drag(SHAPES[id])}>
              {/* The brand colour, from the kit at runtime. */}
              <span style={{ background: id === 'line' ? colorOf('kit:ink', kit) : brand }} className={SHAPE_TILE[id]} />
            </AddTile>
          ))}
        </div>
      </section>
      <section aria-label="Frames" className="space-y-2">
        <h3 className="type-label text-zebra-950">Frames</h3>
        <div className="grid grid-cols-3 gap-2">
          <AddTile label="Add a picture frame" onAdd={() => api.add(imageOf())} {...api.drag(() => imageOf())}>
            <span className="flex h-10 w-14 items-center justify-center rounded-check bg-zebra-100 text-zebra-400">
              <ImageIcon aria-hidden="true" className="size-4" />
            </span>
          </AddTile>
          <AddTile label="Add your logo" onAdd={() => api.add(logoOf())} {...api.drag(() => logoOf())}>
            <span className="max-w-full truncate px-1 type-body text-zebra-950">{business}</span>
          </AddTile>
        </div>
      </section>
    </div>
  );
}
