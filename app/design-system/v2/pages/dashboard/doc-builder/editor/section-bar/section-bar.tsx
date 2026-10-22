'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

import { FLOATING_BAR } from '@/components/ui-v2/control-styles';
import { Tooltip } from '@/components/ui-v2/tooltip';
import type { Section } from '@/features/proposals';

import { docBrandVars } from '../../look/brand-vars';
import { isProdSection } from '../../model/as-production';
import { sectionName, specFor } from '../../registry/kinds';
import { isPartKind } from '../../sections/parts/parts';
import type { DocEditor } from '../../state/use-doc-editor';

import { BackgroundMenu } from './background-menu';
import { ActionsMenu } from './bar-menus';
import { BarOptions } from './bar-options';
import { BarRule } from './bar-parts';
import { LineItemsOptions } from './line-items-options';
import { SignatureOptions } from './signature-options';
import { WidthMenu } from './width-menu';

/**
 * The picked section's bar: one slim strip over the section's top edge,
 * at the page's right, in the editor's own white (founder's reference,
 * 2026-10-10: "something like this but with our options"; then "this
 * shouldn't be black, it should match our style"). Its name, the choice
 * the section is picked for (`BarOptions`), Background and Width, each a
 * short list in words (height is the section's edge, dragged) (`background-menu.tsx`, `bar-menus.tsx`), and the
 * ⋯ menu for moving, hiding, resetting and deleting it.
 * It follows the section as the page scrolls; its name drags it anywhere
 * over the desk, and it then stays where it was put for every section
 * picked after. A new page marker gets none, as in production.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/section-bar
 */

const GAP = 16;

export interface Point {
  x: number;
  y: number;
}

export interface SectionBarProps {
  builder: DocEditor;
  /** The positioned box over the desk the bar is placed in. */
  host: RefObject<HTMLDivElement | null>;
  /** Where the MC dragged it to, in the host's coordinates; null while it follows the section. */
  pinned: Point | null;
  onPin: (at: Point) => void;
}

/** Where the bar sits: across the section's top edge, flush with the page's right, kept in view while the section is. */
function onSection(host: HTMLDivElement, sectionId: string, bar: HTMLElement | null): Point | null {
  // Production's canvas marks each section and the page sheet holding them.
  const el = document.querySelector(`[data-canvas-section-id="${sectionId}"]`);
  const page = el?.closest('[data-page-sheet]')?.getBoundingClientRect();
  if (!el || !page || !bar) return null;
  const box = host.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const x = Math.max(GAP, Math.min(page.right - box.left - bar.offsetWidth - GAP, box.width - bar.offsetWidth - GAP));
  const y = Math.min(Math.max(GAP, r.top - box.top - bar.offsetHeight / 2), r.bottom - box.top - bar.offsetHeight);
  return { x: Math.round(x), y: Math.round(y) };
}

/** The bar. See {@link SectionBarProps}. */
export function SectionBar({ builder, host, pinned, onPin }: SectionBarProps) {
  const { state, selected } = builder;
  const index = state.layout.sections.findIndex((s) => s.id === selected);
  const section = index === -1 ? null : state.layout.sections[index]!;
  const [anchor, setAnchor] = useState<Point | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const id = section?.id;
  // Follows the section each frame while open (scrolling, typing and adding all move it); state changes only when it moves.
  useEffect(() => {
    if (!id || pinned) return;
    let frame = 0;
    const tick = () => {
      const at = host.current ? onSection(host.current, id, bar.current) : null;
      setAnchor((a) => (a && at && a.x === at.x && a.y === at.y ? a : at));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [id, pinned, host]);
  // One floating bar at a time, as Notion and Qwilr do: while words are
  // selected the text bar is the one in use, so this one steps aside,
  // and comes back when the selection goes.
  const [words, setWords] = useState(false);
  useEffect(() => {
    if (!id) return;
    let frame = 0;
    const tick = () => {
      const bar = document.querySelector<HTMLElement>('[role="toolbar"][aria-label="Text"]');
      const on = Boolean(bar?.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
      setWords((w) => (w === on ? w : on));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [id]);
  // A Header and a document's working parts are the engine's own kinds but take the same bar; the Header's choices are in BarOptions.
  const barred = section && (isProdSection(section) || section.kind === 'header' || isPartKind(section.kind)) ? (section as Section) : null;
  if (!barred || barred.kind === 'pageBreak' || builder.light) return null;
  // Drawn hidden until placed, so its own size can be measured for the first placing.
  const at = pinned ?? anchor;

  // Dragging by the name, kept inside the desk.
  const drag = (e: ReactPointerEvent<HTMLParagraphElement>) => {
    if (!host.current || !bar.current || !at) return;
    e.preventDefault();
    const box = host.current.getBoundingClientRect();
    const size = { w: bar.current.offsetWidth, h: bar.current.offsetHeight };
    const grab = { x: e.clientX - box.left - at.x, y: e.clientY - box.top - at.y };
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) =>
      onPin({ x: Math.min(Math.max(0, m.clientX - box.left - grab.x), box.width - size.w), y: Math.min(Math.max(0, m.clientY - box.top - grab.y), box.height - size.h) });
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  const name = sectionName(barred);
  const props = { builder, section: barred };
  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label={`${name} options`}
      // Where it sits is measured at runtime; the brand variables colour the live brand samples.
      style={{ left: at?.x ?? 0, top: at?.y ?? 0, ...docBrandVars(builder.branding.brand_color) }}
      // Its fade-in holds full opacity, so stepping aside swaps the animation out; it fades back in on return.
      aria-hidden={words || undefined}
      className={`absolute z-40 ${FLOATING_BAR} ${!at ? 'invisible' : words ? 'pointer-events-none opacity-0' : 'motion-safe:animate-fade-in'}`}
    >
      <Tooltip side="top" label="Drag to move">
        <p onPointerDown={drag} className="cursor-grab touch-none select-none whitespace-nowrap px-2.5 type-label text-zebra-950 active:cursor-grabbing">
          {name}
        </p>
      </Tooltip>
      <BarRule />
      {/* A working part lays itself out, so in place of a choice it says where its content comes from. */}
      {section?.kind === 'signatures' ? (
        <SignatureOptions builder={builder} section={section} />
      ) : section?.kind === 'lineItems' ? (
        <LineItemsOptions builder={builder} section={section} />
      ) : isPartKind(barred.kind) ? (
        <p className="whitespace-nowrap px-2 type-body text-zebra-500">{specFor(barred.kind).help}</p>
      ) : (
        <BarOptions {...props} />
      )}
      <BarRule />
      <BackgroundMenu {...props} />
      <WidthMenu {...props} />
      <BarRule />
      <ActionsMenu {...props} index={index} />
    </div>
  );
}
