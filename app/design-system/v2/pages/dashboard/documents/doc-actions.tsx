import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';

/**
 * The one action at the end of a Documents row while the document is
 * out. Nudge (a proposal) opens it with Zebri's drafted follow-up and,
 * once sent today, hands over to a Nudged tick in place. Remind (a
 * questionnaire) sends a reminder, then says when it last went.
 *
 * @module app/design-system/v2/pages/dashboard/documents/doc-actions
 */

/** Nudge, or Nudged once sent today. */
export function NudgeAction({ nudged, onNudge }: { nudged: boolean; onNudge: () => void }) {
  return (
    <Swap
      active={nudged ? 'done' : 'nudge'}
      className="justify-items-end"
      states={{
        nudge: (
          <Button variant="secondary" onClick={onNudge}>
            Nudge
          </Button>
        ),
        done: (
          <Badge size="control" tone="brand">
            <DrawnCheck className="size-3.5" />
            Nudged
          </Badge>
        ),
      }}
    />
  );
}

/** Remind, or when the last reminder went. */
export function RemindAction({ remindedOn, onRemind }: { remindedOn?: string | undefined; onRemind: () => void }) {
  return remindedOn ? (
    <span className="type-body text-zebra-400">Reminded {remindedOn}</span>
  ) : (
    <Button variant="secondary" onClick={onRemind}>
      Remind
    </Button>
  );
}
