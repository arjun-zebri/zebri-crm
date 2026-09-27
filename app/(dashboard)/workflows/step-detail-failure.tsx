/**
 * Why the step detail modal refused a Save or an action.
 *
 * It renders at the foot of the modal's scrolling body, under the step's
 * settings and the email preview, so on a long step it sat below the
 * fold and pressing Save changed nothing the MC could see (Phase 6 live
 * check, B3). Each new refusal is scrolled into view and focused, so it
 * is both seen and announced (`role="alert"`). Keyed on `seq`, not the
 * text: the same refusal twice (the MC scrolled back up and pressed Save
 * again) is brought back into view too.
 *
 * @module app/(dashboard)/workflows/step-detail-failure
 */
'use client';

import { useEffect, useRef } from 'react';

/** A refusal and how many there have been, so a repeat is a new one. */
export interface StepDetailFailureState {
  message: string;
  seq: number;
}

/** The refusal line. Renders nothing without one. */
export function StepDetailFailure({ failure }: { failure: StepDetailFailureState | null }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const seq = failure?.seq ?? 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || seq === 0) return;
    // `nearest` so a message already on screen does not jump the body.
    el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  }, [seq]);

  if (!failure) return null;
  return (
    <p ref={ref} role="alert" tabIndex={-1} className="text-body text-danger outline-none">
      {failure.message}
    </p>
  );
}
