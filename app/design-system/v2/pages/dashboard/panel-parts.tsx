import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';

import { agoText } from './demo-activity';

/**
 * The frame the Enquiries and Notifications panels share: a title with
 * Mark all read, and a footer band for the one action that leads out of
 * the popover. Shared so the two read as siblings when the switcher
 * slides between them.
 *
 * @module app/design-system/v2/pages/dashboard/panel-parts
 */

/**
 * Title and Mark all read (greyed out once nothing is unread). `empty`
 * drops the button: with nothing listed there is nothing to mark (user
 * ruling). The row keeps the button's height, so the title stays put.
 */
export function PanelHeader({
  title,
  unread,
  onReadAll,
  empty = false,
}: {
  title: string;
  unread: number;
  onReadAll: () => void;
  empty?: boolean | undefined;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <h2 className="type-subheading text-zebra-950">{title}</h2>
      {empty ? null : (
        <Button variant="ghost" onClick={onReadAll} disabled={unread === 0}>
          Mark all read
        </Button>
      )}
    </div>
  );
}

/**
 * The foot of a panel. Plain white on the panel's own surface: a grey
 * band with a rule above it was rejected (no dividers, no boxes in boxes).
 */
export function PanelFooter({ children }: { children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

/** Time and unread dot at a row's top right. The dot keeps its space when read, so times line up. */
export function WhenDot({ ago, unread }: { ago: string; unread: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2 type-body text-zebra-400">
      {agoText(ago)}
      <span aria-hidden="true" className={`size-2 rounded-pill ${unread ? 'bg-grass-500' : ''}`} />
      {unread ? <span className="sr-only">Unread</span> : null}
    </span>
  );
}
