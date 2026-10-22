
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CallIcon, DocumentsIcon, EnquiriesIcon, PaymentsIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import type { Activity, ActivityKind } from './profile-data';

/**
 * One activity's row content on one line: a round mark saying what kind
 * of thing it is, what happened ("Amelia replied") with the line that
 * matters quieter beside it, and when on the right (2026-10-09 founder
 * mockup). What Zebri did on its own has a green Z, so the MC can
 * see at a glance what was done for them; everything else is grey.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/activity-row
 */

const MARK: Record<Exclude<ActivityKind, 'zebri'>, ZebriIcon> = {
  message: EnquiriesIcon,
  payment: PaymentsIcon,
  document: DocumentsIcon,
  call: CallIcon,
};

/** The row's content, inside an {@link ExpandRow}. */
export function ActivityRow({ item }: { item: Activity }) {
  return (
    <>
      {item.kind === 'zebri' ? (
        // Zebri's own mark, a green Z, not a stock AI sparkle (founder, 2026-10-09).
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-grass-50 type-label text-grass-700"
        >
          Z
        </span>
      ) : (
        <Mark kind={item.kind} />
      )}
      <span className="min-w-0 flex-1 truncate type-body">
        <span className="text-zebra-950">
          {item.who} {item.text}
        </span>
        {item.sub ? <span className="ml-2 text-zebra-400">{item.sub}</span> : null}
      </span>
      <span className="shrink-0 type-body text-zebra-400">{item.time}</span>
    </>
  );
}

/** A grey round mark with the kind's glyph. */
function Mark({ kind }: { kind: Exclude<ActivityKind, 'zebri'> }) {
  return <IconCircle icon={MARK[kind]} />;
}
