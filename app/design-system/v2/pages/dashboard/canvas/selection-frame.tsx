'use client';

import type { PointerEvent } from 'react';

import { HANDLES, type Handle, type Rect } from './geometry';
import { RequiredBadge } from './required-badge';

/**
 * The selection's frame: a 2px outline in the `selected` colour (the
 * hover outline is the same colour, lighter) around what is picked and, for a
 * single element, eight handles to resize it by (corners keep a picture's
 * shape). Drawn in page pixels inside the scaled page, so its line and
 * handle sizes are divided by the zoom to stay the same on screen. A
 * required part (locked) shows the Required badge, as the toolbar does: it
 * moves and styles, but cannot be deleted.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/selection-frame
 */

/** Where each handle sits on the frame, as fractions of its width and height. */
const AT: Record<Handle, [number, number]> = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};

const CURSOR: Record<Handle, string> = {
  nw: 'cursor-nwse-resize', se: 'cursor-nwse-resize', ne: 'cursor-nesw-resize', sw: 'cursor-nesw-resize',
  n: 'cursor-ns-resize', s: 'cursor-ns-resize', e: 'cursor-ew-resize', w: 'cursor-ew-resize',
};

export interface SelectionFrameProps {
  rect: Rect;
  zoom: number;
  /** Draw resize handles (one element, not typing into it). */
  handles: boolean;
  locked: boolean;
  /** Only the left and right handles: a text's height follows its words. */
  sidesOnly?: boolean | undefined;
  onHandle: (e: PointerEvent, handle: Handle) => void;
}

/** The frame. See {@link SelectionFrameProps}. */
export function SelectionFrame({ rect, zoom, handles, locked, sidesOnly = false, onHandle }: SelectionFrameProps) {
  const size = 10 / zoom;
  return (
    // Its box is the selection's, in page pixels: runtime values, set inline.
    <div style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderWidth: 2 / zoom }} className="pointer-events-none absolute border-solid border-selected">
      {locked ? (
        // Sits on the frame's top edge, kept screen-size: scaled back by the zoom from its bottom-left corner.
        <span style={{ marginBottom: 4 / zoom, transform: `scale(${1 / zoom})` }} className="absolute bottom-full left-0 flex origin-bottom-left">
          <RequiredBadge tip={false} />
        </span>
      ) : null}
      {handles
        ? HANDLES.filter((h) => !sidesOnly || h === 'e' || h === 'w').map((h) => {
            const [fx, fy] = AT[h];
            return (
              <span
                key={h}
                role="presentation"
                onPointerDown={(e) => onHandle(e, h)}
                style={{ left: `calc(${fx * 100}% - ${size / 2}px)`, top: `calc(${fy * 100}% - ${size / 2}px)`, width: size, height: size, borderWidth: 1.5 / zoom }}
                className={`pointer-events-auto absolute touch-none rounded-pill border-solid border-selected bg-field shadow-sm ${CURSOR[h]}`}
              />
            );
          })
        : null}
    </div>
  );
}
