'use client';

import { useRef, useState } from 'react';

import { useCanvasData } from './canvas-context';
import { ElementView } from './element-view';
import { bounds } from './geometry';
import { autoHeight, type CanvasPage } from './model';
import { takeDragged } from './rail/drag';
import { DRAG_TYPE, place } from './rail/presets';
import { colorOf, frameCss } from './resolve';
import { SelectionFrame } from './selection-frame';
import { useAutoHeight } from './use-auto-height';
import type { Canvas } from './use-canvas';
import { useGesture } from './use-gesture';

/**
 * One page of the document in the editor, drawn at full size and scaled
 * by `zoom`: its background, its elements in stacking order, a thin
 * outline on the element under the pointer, the selection frame with its
 * handles, and the snapping guides while something moves. Click selects
 * (Shift adds), dragging moves, a handle resizes, a double click types
 * into text, and a click on the empty page clears the selection.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/page-view
 */

export interface PageViewProps {
  page: CanvasPage;
  canvas: Canvas;
  zoom: number;
  /** The element whose text is being typed into. */
  editing: string | null;
  onEditing: (id: string | null) => void;
}

/** One editable page. See {@link PageViewProps}. */
export function PageView({ page, canvas, zoom, editing, onEditing }: PageViewProps) {
  const { kit } = useCanvasData();
  const g = useGesture(canvas, page, zoom);
  const [hover, setHover] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useAutoHeight(sheet, page, canvas);
  const picked = page.elements.filter((el) => canvas.selected.includes(el.id));
  return (
    // The page's size is runtime data (an A4 page, or a long web page), so it is set inline.
    <div
      data-page={page.id}
      style={{ width: page.width * zoom, height: page.height * zoom }}
      className="relative shrink-0"
      // A tile from the rail dropped here lands where it was let go.
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        const el = takeDragged();
        if (!el) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        canvas.add(page.id, place(el, page, { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }));
      }}
    >
      <div
        ref={sheet}
        style={{ width: page.width, height: page.height, transform: `scale(${zoom})`, background: colorOf(page.background, kit) }}
        className="absolute left-0 top-0 origin-top-left overflow-hidden shadow-lg ring-1 ring-hairline"
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          canvas.select([]);
          onEditing(null);
        }}
        onPointerMove={g.move}
        onPointerUp={g.end}
        onPointerCancel={g.end}
      >
        {page.elements.map((el) => (
          <div
            key={el.id}
            data-element={el.id}
            style={frameCss(el)}
            className={`touch-none select-none ${editing === el.id ? 'cursor-text' : 'cursor-move'}`}
            onPointerEnter={() => setHover(el.id)}
            onPointerLeave={() => setHover((h) => (h === el.id ? null : h))}
            onPointerDown={(e) => {
              if (editing === el.id) return;
              e.stopPropagation();
              onEditing(null);
              const ids = e.shiftKey
                ? canvas.selected.includes(el.id)
                  ? canvas.selected.filter((id) => id !== el.id)
                  : [...canvas.selected, el.id]
                : canvas.selected.includes(el.id)
                  ? canvas.selected
                  : [el.id];
              canvas.select(ids);
              g.begin(e, ids);
            }}
            // A required part's words are the document's: it restyles, but is not typed into.
            onDoubleClick={() => el.kind === 'text' && !el.locked && onEditing(el.id)}
          >
            <ElementView
              el={el}
              editing={editing === el.id}
              onText={(text) => {
                // Only real changes go into history (StrictMode's rehearsal unmount commits too).
                if (el.kind === 'text' && text !== el.text) canvas.update([el.id], { text });
              }}
              onDone={() => onEditing(null)}
            />
            {/* Hover outline: what a click would pick, before it is picked; the selection's colour, lighter. */}
            {hover === el.id && !canvas.selected.includes(el.id) && !g.active() ? (
              <span style={{ borderWidth: 1.5 / zoom }} className="pointer-events-none absolute inset-0 border-solid border-selected/50" />
            ) : null}
          </div>
        ))}
        {picked.length ? (
          <SelectionFrame
            rect={bounds(picked)}
            zoom={zoom}
            handles={picked.length === 1 && editing === null}
            sidesOnly={picked.length === 1 && autoHeight(picked[0]!)}
            locked={picked.every((el) => el.locked)}
            onHandle={(e, handle) => (e.stopPropagation(), g.begin(e, [picked[0]!.id], handle))}
          />
        ) : null}
        {g.guides.map((guide) => (
          <span
            key={`${guide.axis}-${guide.at}`}
            style={guide.axis === 'x' ? { left: guide.at, width: 1 / zoom } : { top: guide.at, height: 1 / zoom }}
            className={`pointer-events-none absolute bg-azure-500 ${guide.axis === 'x' ? 'inset-y-0' : 'inset-x-0'}`}
          />
        ))}
      </div>
    </div>
  );
}
