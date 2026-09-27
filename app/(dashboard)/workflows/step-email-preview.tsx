'use client';

/**
 * The held send, as the couple will receive it.
 *
 * Sits under the step's message fields in the detail modal. The first
 * frame is the server's render of the step as saved (it arrives with the
 * step itself). Once the MC edits the subject or message, it re-renders,
 * debounced, through `previewStepAction` with those edits applied the
 * way approving would apply them, so what they read before pressing Send
 * is what goes out, shell, signature and footer included. Above the
 * frame sits the envelope (sender, recipients, reply-to, send time,
 * attachments), which travels with each render.
 *
 * @module app/(dashboard)/workflows/step-email-preview
 */

import type { ReviewEdits, StepPreview } from '@/lib/workflows/review';

import { EmailPreview } from './[id]/email-preview';
import { previewStepAction } from './instance-actions';
import { PreviewFailed } from './preview-failed';
import { StepEnvelope } from './step-envelope';
import { useServerPreview } from './use-server-preview';

export interface StepEmailPreviewProps {
  stepId: string;
  /** The server's render of the step as saved. */
  initial: StepPreview;
  /** Only the fields the MC changed, or undefined when none. */
  edits: ReviewEdits | undefined;
  /** True once the fields differ from the saved step. */
  dirty: boolean;
  /** Whose inbox this is, for the caption. */
  coupleName: string | null;
}

/** The caption under the frame. "Exactly" only for a current, non-empty render. */
function captionFor(state: { dirty: boolean; error: boolean; fresh: boolean; hasEmail: boolean; who: string }): string {
  if (state.dirty && state.error) return 'The last preview, from before your latest edits.';
  if (!state.fresh) return 'Updating the preview with your edits.';
  if (!state.hasEmail) return 'There is nothing to show for this email yet.';
  const exactly = `Exactly what ${state.who} receives. Links are inactive here.`;
  return state.dirty ? `With your edits. ${exactly}` : exactly;
}

/** The rendered email for a step. See {@link StepEmailPreviewProps}. */
export function StepEmailPreview({ stepId, initial, edits, dirty, coupleName }: StepEmailPreviewProps) {
  const edited = useServerPreview(
    JSON.stringify([stepId, edits ?? null]),
    () => previewStepAction({ stepId, ...(edits ? { edits } : {}) }),
    { enabled: dirty },
  );

  // Untouched: the saved render, which is exactly what goes out. Edited:
  // the latest edited render, or the saved one until the first lands,
  // dimmed under "Updating" either way until it is for the text now in
  // the fields. Falling back keeps the frame mounted: unmounting it while
  // the first edited render was on its way is what left it blank (live
  // check B1). Reverting switches the hook off, which forgets every
  // edited render.
  const shown = dirty ? (edited.data ?? initial) : initial;
  const fresh = !dirty || edited.current;
  const caption = captionFor({
    dirty,
    error: edited.error !== null,
    fresh,
    hasEmail: Boolean(shown.html),
    who: coupleName ?? 'the couple',
  });

  // An edit can change only a dropped template's files and the unfilled
  // lists, so an edited render carries just those (`envelopePatch`) over
  // the saved envelope. Until it lands the saved one stands in, dimmed
  // like the frame.
  const envelope =
    dirty && shown.envelopePatch && initial.envelope
      ? { ...initial.envelope, ...shown.envelopePatch }
      : initial.envelope;

  return (
    <div className="space-y-3">
      {envelope ? <StepEnvelope envelope={envelope} pending={!fresh} /> : null}
      {/* A failed refresh always offers Try again, over the dimmed
          earlier render. */}
      {dirty && edited.error ? <PreviewFailed error={edited.error} onRetry={edited.retry} /> : null}
      <EmailPreview
        ready={Boolean(shown.html)}
        pending={!fresh}
        // A gap in the subject shows as `[Event date]` here; the field
        // above keeps the subject as written.
        subject={shown.subjectPreview || shown.subject || 'No subject'}
        html={shown.html ?? ''}
        frameTitle="Email preview"
        caption={caption}
        height="h-96"
      />
    </div>
  );
}
