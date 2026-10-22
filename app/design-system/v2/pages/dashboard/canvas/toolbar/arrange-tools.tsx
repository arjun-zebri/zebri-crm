'use client';

import { MENU_LABEL } from '@/components/ui-v2/control-styles';
import { AlignBottomIcon, AlignCentreEdgeIcon, AlignLeftEdgeIcon, AlignMiddleIcon, AlignRightEdgeIcon, AlignTopIcon, BringToFrontIcon, CopyLinkIcon, LayersIcon, SendToBackIcon, TrashIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { MenuOption } from '@/components/ui-v2/popover';

import { Tool, ToolMenu } from '../../scripts/script-tools';
import { ICON } from '../icon-props';
import { findElement, type CanvasElement } from '../model';
import type { Canvas } from '../use-canvas';

/**
 * The arrange end of the toolbar: a Position menu (front and back, and
 * lining the pick up with its page's edges or middle), duplicate, and
 * delete. A required part has no delete: it moves and styles, but an
 * invoice without its total is not an invoice.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/toolbar/arrange-tools
 */

type Edge = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';

const ALIGN: { edge: Edge; label: string; icon: ZebriIcon }[] = [
  { edge: 'left', label: 'Left', icon: AlignLeftEdgeIcon },
  { edge: 'centre', label: 'Centre', icon: AlignCentreEdgeIcon },
  { edge: 'right', label: 'Right', icon: AlignRightEdgeIcon },
  { edge: 'top', label: 'Top', icon: AlignTopIcon },
  { edge: 'middle', label: 'Middle', icon: AlignMiddleIcon },
  { edge: 'bottom', label: 'Bottom', icon: AlignBottomIcon },
];

/** Where `el` goes to sit on `edge` of a page `pw` by `ph`. */
function aligned(el: CanvasElement, edge: Edge, pw: number, ph: number): Partial<CanvasElement> {
  switch (edge) {
    case 'left': return { x: 0 };
    case 'centre': return { x: Math.round((pw - el.w) / 2) };
    case 'right': return { x: pw - el.w };
    case 'top': return { y: 0 };
    case 'middle': return { y: Math.round((ph - el.h) / 2) };
    case 'bottom': return { y: ph - el.h };
  }
}

/** The arrange tools for the selection. */
export function ArrangeTools({ canvas, picked }: { canvas: Canvas; picked: CanvasElement[] }) {
  const ids = picked.map((el) => el.id);
  const locked = picked.some((el) => el.locked);
  const align = (edge: Edge) =>
    canvas.update(ids, (el) => {
      const page = findElement(canvas.doc, el.id)?.page;
      return page ? aligned(el, edge, page.width, page.height) : {};
    });
  return (
    <>
      <ToolMenu name="Position" current={<LayersIcon {...ICON} />}>
        {(close) => (
          <>
            <MenuOption onSelect={() => (canvas.order(ids, 'front'), close())}>
              <span className="flex items-center gap-2"><BringToFrontIcon {...ICON} />Bring to front</span>
            </MenuOption>
            <MenuOption onSelect={() => (canvas.order(ids, 'back'), close())}>
              <span className="flex items-center gap-2"><SendToBackIcon {...ICON} />Send to back</span>
            </MenuOption>
            <p className={MENU_LABEL}>Line up with the page</p>
            {ALIGN.map(({ edge, label, icon: Icon }) => (
              <MenuOption key={edge} onSelect={() => (align(edge), close())}>
                <span className="flex items-center gap-2"><Icon {...ICON} />{label}</span>
              </MenuOption>
            ))}
          </>
        )}
      </ToolMenu>
      {locked ? null : (
        <>
          <Tool label="Duplicate (⌘D)" onClick={() => canvas.duplicate(ids)}>
            <CopyLinkIcon {...ICON} />
          </Tool>
          <Tool label="Delete" onClick={() => canvas.remove(ids)}>
            <TrashIcon {...ICON} />
          </Tool>
        </>
      )}
    </>
  );
}
