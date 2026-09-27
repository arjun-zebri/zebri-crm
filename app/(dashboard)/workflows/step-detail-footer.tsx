'use client';

/**
 * The step detail modal's footer: open the couple, snooze, save, and the
 * step's own verb (Send & complete, Try again or Mark done).
 *
 * Rendered even while the step is loading, so the footer band and the
 * modal's height are the same before and after: a modal that grows under
 * the cursor moves the button the MC was reaching for. Split out of
 * `./step-detail-modal` to keep it to its size budget.
 *
 * @module app/(dashboard)/workflows/step-detail-footer
 */

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

/** What the footer acts on. */
export type StepDetailVerb = 'send' | 'tick' | 'snooze' | 'retry';

export interface StepDetailFooterProps {
  /** False while the step loads: only a disabled placeholder shows. */
  loaded: boolean;
  coupleId: string | null;
  /** The step has a form, so Save is offered. */
  canSave: boolean;
  errored: boolean;
  automated: boolean;
  /**
   * Why this send is still behind an earlier step, or null. When set,
   * Snooze and Send & complete are not offered: a date would run it on
   * sight and Send would run it now, either one out of order.
   */
  blockedReason: string | null;
  saving: boolean;
  acting: boolean;
  onSave: () => void;
  onAct: (verb: StepDetailVerb) => void;
}

/** The footer. See {@link StepDetailFooterProps}. */
export function StepDetailFooter({
  loaded,
  coupleId,
  canSave,
  errored,
  automated,
  blockedReason,
  saving,
  acting,
  onSave,
  onAct,
}: StepDetailFooterProps) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {coupleId ? (
        <Button variant="ghost" onClick={() => router.push(`/couples?openCouple=${coupleId}`)}>
          Open the couple
        </Button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {!loaded ? (
          <Button disabled>Loading</Button>
        ) : blockedReason ? (
          <>
            <p className="text-body text-text-muted">{blockedReason}</p>
            {canSave ? (
              <Button variant="outline" onClick={onSave} loading={saving}>
                Save
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onAct('snooze')}>
              Snooze
            </Button>
            {/* Keeping an edit is its own decision: an MC who reworded a
                send and then snoozed it should still have the rewording
                when it comes back. */}
            {canSave ? (
              <Button variant="outline" onClick={onSave} loading={saving}>
                Save
              </Button>
            ) : null}
            {errored ? (
              <Button onClick={() => onAct('retry')} loading={acting}>
                Try again
              </Button>
            ) : automated ? (
              <Button onClick={() => onAct('send')} loading={acting}>
                Send &amp; complete
              </Button>
            ) : (
              <Button onClick={() => onAct('tick')} loading={acting}>
                Mark done
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
