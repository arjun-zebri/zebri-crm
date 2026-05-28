/**
 * Marquee drag-select for the couples list table.
 *
 * Mouse-down on the table background starts a rectangle; mouse-up
 * adds every row whose bounding rect intersects the marquee to the
 * selected set. A 4-pixel deadzone distinguishes drags from clicks.
 *
 * After the drag completes, a one-shot capture-phase listener
 * swallows the post-drag `click` event — otherwise the page's
 * background-click handler would clear the selection we just made.
 *
 * Returns refs for the container + start sentinel, and the
 * current drag-rect (for the absolute-positioned overlay rendered
 * via portal).
 *
 * @module app/(dashboard)/couples/use-couples-list-drag-select
 */
'use client';

import { useEffect, useRef, useState } from 'react';

export interface DragRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UseCouplesListDragSelectArgs {
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export interface UseCouplesListDragSelectResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  dragRect: DragRect | null;
  /** Mouse-down handler for the table container. Skips text inputs
   *  + buttons so users can still type in the search row / click
   *  pagination controls. */
  onContainerMouseDown: (e: React.MouseEvent) => void;
  /** True while a drag is in progress — the table's row-click
   *  handler reads this to suppress click-through on drag-release. */
  justDraggedRef: React.MutableRefObject<boolean>;
}

export function useCouplesListDragSelect({
  selectedIds,
  onSelectionChange,
}: UseCouplesListDragSelectArgs): UseCouplesListDragSelectResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const justDraggedRef = useRef(false);
  const dragRectRef = useRef<DragRect | null>(null);
  const [dragRect, setDragRect] = useState<DragRect | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        isDraggingRef.current = true;
        document.body.style.userSelect = 'none';
        const newRect: DragRect = {
          x: Math.min(e.clientX, dragStartRef.current.x),
          y: Math.min(e.clientY, dragStartRef.current.y),
          w: Math.abs(dx),
          h: Math.abs(dy),
        };
        dragRectRef.current = newRect;
        setDragRect(newRect);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current && dragRectRef.current) {
        const r = dragRectRef.current;
        const rows = containerRef.current?.querySelectorAll<HTMLElement>(
          'tr[data-couple-id]',
        );
        if (rows) {
          const newSelected = new Set(selectedIds);
          rows.forEach((row) => {
            const rowRect = row.getBoundingClientRect();
            if (
              rowRect.left < r.x + r.w &&
              rowRect.right > r.x &&
              rowRect.top < r.y + r.h &&
              rowRect.bottom > r.y
            ) {
              const coupleId = row.getAttribute('data-couple-id');
              if (coupleId) newSelected.add(coupleId);
            }
          });
          onSelectionChange(newSelected);
        }
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 100);

        // Swallow the click that fires after the drag — otherwise
        // the page's background-click handler clears the selection
        // we just made.
        const suppressNextClick = (e: MouseEvent) => {
          e.stopImmediatePropagation();
          window.removeEventListener('click', suppressNextClick, true);
        };
        window.addEventListener('click', suppressNextClick, true);
        setTimeout(
          () => window.removeEventListener('click', suppressNextClick, true),
          250,
        );
      }
      dragStartRef.current = null;
      isDraggingRef.current = false;
      dragRectRef.current = null;
      document.body.style.userSelect = '';
      setDragRect(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedIds, onSelectionChange]);

  const onContainerMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  return { containerRef, dragRect, onContainerMouseDown, justDraggedRef };
}
