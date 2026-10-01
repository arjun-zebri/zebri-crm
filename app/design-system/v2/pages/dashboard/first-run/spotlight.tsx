'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Panel } from '@/components/ui-v2/panel';

/**
 * The guide pointing at a real control: a grass ring around the element
 * whose `data-tour` is `target`, and a short note under it saying what
 * to do there. It follows the element as the page lays out and scrolls,
 * and steps aside while a dialog is open (the dialog is the next part of
 * the job, and the ring would sit behind it anyway). Nothing is dimmed
 * and nothing moves: the page stays usable, the ring just says "here".
 *
 * @module app/design-system/v2/pages/dashboard/first-run/spotlight
 */

export interface SpotlightProps {
  /** The `data-tour` value of the control to ring. */
  target: string;
  title: string;
  body: string;
  /** Extra buttons under the note (Use a test client). */
  actions?: ReactNode;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The note's width, and the gap it keeps from the control and the window's edge. */
const NOTE = 304;
const GAP = 12;

/** Where the target is, or null when it is off screen, hidden or behind a dialog. */
function measure(target: string): Box | null {
  if (document.querySelector('dialog[open]')) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  const r = el?.getBoundingClientRect();
  if (!r || r.width === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const same = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/** The spotlight. See {@link SpotlightProps}. */
export function Spotlight({ target, title, body, actions }: SpotlightProps) {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    // One frame loop rather than observers: the target can mount late, move
    // with a tab switch, or be covered by a dialog, and all read the same way.
    let frame = 0;
    const tick = () => {
      const next = measure(target);
      setBox((b) => (same(b, next) ? b : next));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [target]);
  if (!box) return null;

  // Under the control, its right edge lined up with the control's, kept on screen.
  const left = Math.min(Math.max(GAP, box.left + box.width - NOTE), window.innerWidth - NOTE - GAP);
  const vars = {
    '--x': `${box.left - 4}px`,
    '--y': `${box.top - 4}px`,
    '--w': `${box.width + 8}px`,
    '--h': `${box.height + 8}px`,
    '--nx': `${left}px`,
    '--ny': `${box.top + box.height + GAP}px`,
  } as CSSProperties;
  return createPortal(
    <div style={vars}>
      <span
        aria-hidden="true"
        className="pointer-events-none fixed left-[var(--x)] top-[var(--y)] z-40 h-[var(--h)] w-[var(--w)] rounded-panel ring-2 ring-grass-600 motion-safe:animate-fade-in"
      />
      <Panel
        raised
        role="note"
        aria-label={title}
        className="fixed left-[var(--nx)] top-[var(--ny)] z-40 w-[19rem] space-y-1 p-4 motion-safe:animate-[rise-in_320ms_cubic-bezier(0.2,0.7,0.2,1)_both]"
      >
        <p className="type-label text-zebra-950">{title}</p>
        <p className="type-body text-zebra-500">{body}</p>
        {actions ? <div className="flex justify-end gap-2 pt-2">{actions}</div> : null}
      </Panel>
    </div>,
    document.body,
  );
}
