'use client';

/**
 * The Outreach title row: the page name, today's send counts, and the
 * one page-level action, "Check replies now".
 *
 * Both extras need a connected mailbox: counts with no mailbox are just
 * zeros, and "Check replies now" has nothing to check. The button is
 * also Today's action, so it shows only on the Today view.
 *
 * @module features/outreach/outreach-header
 */
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { checkRepliesNowAction } from '@/features/outreach/actions';
import { useOutreachMutation, useToday, type OutreachToastLine } from '@/features/outreach/hooks';
import type { PollResult } from '@/lib/outreach/services/poll';
import type { TodayData } from '@/lib/outreach/services/queries';

/** Reads the poll result the action returns into a short toast line. */
export function pollSummary(r: PollResult): string | OutreachToastLine {
  // A recent poll is not a success or a failure, just news, so it gets the neutral tone.
  if (!r.polled) return { message: 'Mailbox was checked a moment ago. Try again shortly.', tone: 'info' };
  return `${r.replies} ${r.replies === 1 ? 'reply' : 'replies'}, ${r.bounces} ${r.bounces === 1 ? 'bounce' : 'bounces'}`;
}

/** "3/20" against a cap, or "3 (off)" when the cap is 0 (sending turned off on purpose). */
export function capText(sent: number, cap: number): string {
  return cap > 0 ? `${sent}/${cap}` : `${sent} (off)`;
}

/**
 * Whether the header's extras show. Both need a mailbox; the check button
 * also needs to be on Today, the only view where replies are acted on.
 *
 * @param view - The active Outreach view id.
 * @param mailboxConnected - Whether a Gmail mailbox is connected.
 * @returns Which header extras to render.
 */
export function headerExtras(view: string, mailboxConnected: boolean): { counts: boolean; checkReplies: boolean } {
  return { counts: mailboxConnected, checkReplies: mailboxConnected && view === 'today' };
}

/** Today's email and DM counts against their caps, as one muted line. */
function TodayCounts({ d }: { d: TodayData }) {
  return (
    <span className="text-body text-text-subtle">
      Today: {capText(d.emailSentToday, d.emailCap)} emails · {capText(d.igSentToday, d.igCap)} DMs
    </span>
  );
}

/**
 * The Outreach page header.
 *
 * @param props.view - Active view id. Defaults to `'today'`, where the check button shows.
 */
export function OutreachHeader({ view = 'today' }: { view?: string }) {
  const today = useToday();
  const check = useOutreachMutation(checkRepliesNowAction, pollSummary);
  const extras = headerExtras(view, today.data?.mailboxConnected ?? false);
  return (
    <PageHeader
      title="Outreach"
      meta={extras.counts && today.data ? <TodayCounts d={today.data} /> : null}
      actions={
        extras.checkReplies ? (
          <Button variant="outline" loading={check.isPending} disabled={check.isPending} onClick={() => check.mutate(undefined)}>
            Check replies now
          </Button>
        ) : null
      }
    />
  );
}
