'use client';

/**
 * What a held pre-composed email sends, in the step detail.
 *
 * The portal link, questionnaire, contract, invoice, run sheet and
 * post-event emails compose their wording inside the send, and nothing
 * renders it for review yet. Rather than approve a bare label, the MC
 * reads what the email is, its envelope (from, to, when), and plainly
 * that its preview is not available (Phase 5 fix wave, I3).
 *
 * @module app/(dashboard)/workflows/step-precomposed-note
 */

import { PREVIEW_UNAVAILABLE } from '@/lib/workflows/precomposed-copy';
import type { SendEnvelope } from '@/lib/workflows/send-envelope';

import { StepEnvelope } from './step-envelope';

export interface StepPrecomposedNoteProps {
  /** What the email is, in words (`StepPreview.precomposed`). */
  sends: string;
  /** Its envelope, or null when it could not be read. */
  envelope: SendEnvelope | null;
}

/** The note. See {@link StepPrecomposedNoteProps}. */
export function StepPrecomposedNote({ sends, envelope }: StepPrecomposedNoteProps) {
  return (
    <section aria-label="What this sends" className="space-y-2">
      <p className="text-body text-text">{sends}</p>
      {/* The envelope carries the no-preview line as its notice. */}
      {envelope ? (
        <StepEnvelope envelope={envelope} />
      ) : (
        <p className="text-body text-text-muted">{PREVIEW_UNAVAILABLE}</p>
      )}
    </section>
  );
}
