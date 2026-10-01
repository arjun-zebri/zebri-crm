import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Swap } from '@/components/ui-v2/swap';

import { listById, type Moment } from '../campaigns-data';
import { templateById } from '../email-data';

/**
 * One send Zebri thinks is worth doing now, on the Overview: what it is,
 * why now (with the number behind it), and who it goes to with which
 * template. Review, in its own column, opens it ready to send; once
 * scheduled it hands over to a Scheduled tick in place. Clicking
 * anywhere else on the row opens it too.
 *
 * @module app/design-system/v2/pages/dashboard/email/overview/moment-row
 */

export interface MomentRowProps {
  moment: Moment;
  scheduled: boolean;
  onReview: () => void;
}

/** A suggested send. See {@link MomentRowProps}. */
export function MomentRow({ moment: m, scheduled, onReview }: MomentRowProps) {
  const list = listById(m.list);
  return (
    <div className="relative -mx-2 flex cursor-pointer items-start gap-4 rounded-button px-2 py-4 transition-colors duration-150 hover:bg-zebra-950/[0.03] motion-reduce:transition-none">
      <div className="min-w-0 flex-1 space-y-1">
        <StretchedButton label={`Review: ${m.title}`} onClick={onReview}>
          <span className="block type-label text-zebra-950">{m.title}</span>
        </StretchedButton>
        <p className="type-body text-zebra-700">{m.why}</p>
        <p className="type-body text-zebra-500">
          {m.people} from {list.name} · {templateById(m.template).name}
        </p>
      </div>
      {/* Wide enough for the Scheduled tick, the widest thing it holds. */}
      <div className="relative z-10 flex w-32 shrink-0 justify-end">
        <Swap
          active={scheduled ? 'done' : 'act'}
          className="justify-items-end"
          states={{
            act: (
              <Button variant="secondary" onClick={onReview}>
                Review
              </Button>
            ),
            done: (
              <Badge size="control" tone="brand">
                <DrawnCheck className="size-3.5" />
                Scheduled
              </Badge>
            ),
          }}
        />
      </div>
    </div>
  );
}
