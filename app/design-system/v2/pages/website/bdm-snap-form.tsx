'use client';

import { useEffect, useState } from 'react';

import { EditIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { EASE, Status, type SnapProps } from './bdm-snap-parts';

/**
 * Step 1 of the BDM lodgement band: the couple finishing their part of
 * the notice on their phone. Two answers are in already; the one that
 * moves is the answer the band follows to the end, First given name,
 * typed as "Amelia Rose", a real slip (BDM takes one word there), which
 * step 2 catches and step 3 lodges fixed (founder, 2026-10-19: the steps
 * did not flow, and uneven letter-by-letter typing read as clunky). It
 * types at one steady, unhurried pace (95ms a letter), the boxed input's
 * focus ring and a caret on that field only, then the status turns to
 * Saved. The band's shared status line on top; under it the couple's own
 * form, boxed fields as on their phone, so this step looks like what it
 * is (founder, 2026-10-19: identical rows on all three could not be told
 * apart). DEMO CONTENT.
 *
 * @module app/design-system/v2/pages/website/bdm-snap-form
 */

/** The answer the band follows through all three steps. */
export const SLIP = 'Amelia Rose';

/** A breath before the first letter, then one steady letter gap: smooth, not human-jittery. */
const START_MS = 450;
const LETTER_MS = 95;
const SAVED_MS = 600;
/** How long the play runs, for the band's pacing: typed, Saved, a beat to read it. */
export const FORM_MS = START_MS + SLIP.length * LETTER_MS + SAVED_MS + 1000;

/** Types the slip in while `on`, one letter at a time at a steady pace. */
function useTyped(on: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on || n >= SLIP.length) return;
    const id = window.setTimeout(() => setN((x) => x + 1), n === 0 ? START_MS : LETTER_MS);
    return () => window.clearTimeout(id);
  }, [on, n]);
  return n;
}

/** One question, as the couple's form asks it: its name over a boxed field. */
function Field({ label, value, typing = false }: { label: string; value: string; typing?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="type-body text-zebra-700">{label}</p>
      {/* The boxed input's own focus ring, drawn on, since a picture cannot hold focus. */}
      <div className={`relative rounded-panel ${EASE} ${typing ? 'ring-4 ring-zebra-950/[0.06]' : 'ring-0'}`}>
        <Input boxed labelHidden label={label} value={value} readOnly tabIndex={-1} />
        {typing ? (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center type-body">
            <span className="invisible whitespace-pre">{value}</span>
            <span className="ml-px h-4 w-px bg-zebra-950" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The couple's answers, the slip typed in. See {@link SnapProps}. */
export function FormSnap({ playing, done }: SnapProps) {
  const typed = useTyped(playing);
  const n = done ? SLIP.length : playing ? typed : 0;
  const finished = n >= SLIP.length;
  // Saved a beat after the last letter, as autosave would.
  const [savedNow, setSaved] = useState(false);
  useEffect(() => {
    if (!playing || !finished) return;
    const id = window.setTimeout(() => setSaved(true), SAVED_MS);
    return () => window.clearTimeout(id);
  }, [playing, finished]);
  const saved = done || savedNow;
  const typing = playing && !saved;
  return (
    <div>
      <Status
        state={saved ? 'done' : 'idle'}
        icon={EditIcon}
        title={saved ? 'Saved' : 'Amelia is filling it in'}
        detail="Her details · Part 1 of 9"
      />
      <div className="mt-4 space-y-2.5">
        <Field label="First given name" value={SLIP.slice(0, n)} typing={typing} />
        <Field label="Family name" value="Hart" />
      </div>
    </div>
  );
}
