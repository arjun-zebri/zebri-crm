import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';

import { shortDate } from '../../payments/dates';
import { money } from '../../payments/payments-data';
import { CONSENT_WORDS, bookedValue, listById, reachOf, type Campaign } from '../campaigns-data';
import { MAILBOX, pct } from '../email-data';
import type { EmailState } from '../use-email-state';

/**
 * The campaign modal's side column, bare facts on the white, no boxes.
 * A sent campaign leads with the money: what was booked from it and by
 * whom. Then the plain funnel (delivered to unsubscribed, each with its
 * share of what was delivered), then who opened and has not booked, each
 * with a real Follow up button that hands over to a Followed up tick. A
 * draft or scheduled campaign shows who it goes to (with the consent the
 * list rests on), when, and from which mailbox.
 *
 * @module app/design-system/v2/pages/dashboard/email/campaigns/campaign-side
 */

export interface CampaignSideProps {
  campaign: Campaign;
  state: EmailState;
}

/** The facts before a campaign goes out. */
function Upcoming({ campaign: c }: { campaign: Campaign }) {
  const list = listById(c.list);
  return (
    <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 type-body">
      <dt className="text-zebra-500">To</dt>
      <dd className="text-zebra-950">
        {list.name}, {reachOf(list)} people
        <span className="block text-zebra-500">{CONSENT_WORDS[list.consent]}</span>
      </dd>
      <dt className="text-zebra-500">Goes out</dt>
      <dd className="text-zebra-950">{c.group === 'scheduled' && c.on ? `${shortDate(c.on)}, 9:00 am` : 'Not scheduled'}</dd>
      <dt className="text-zebra-500">From</dt>
      <dd className="truncate text-zebra-950">{MAILBOX.address}</dd>
    </dl>
  );
}

/** Side column for a campaign. See {@link CampaignSideProps}. */
export function CampaignSide({ campaign: c, state }: CampaignSideProps) {
  if (c.group !== 'sent') return <Upcoming campaign={c} />;
  const funnel: [string, number][] = [
    ['Delivered', c.delivered],
    ['Opened', c.opened],
    ['Clicked', c.clicked],
    ['Replied', c.replied],
    ['Unsubscribed', c.unsubscribed],
  ];
  return (
    <div className="space-y-8">
      <section aria-labelledby="campaign-booked" className="space-y-3">
        <h3 id="campaign-booked" className="type-body text-zebra-500">
          Booked from this email
        </h3>
        <p className="type-heading tabular-nums text-zebra-950">{money(bookedValue(c))}</p>
        {c.booked.length ? (
          <ul className="space-y-2.5 type-body">
            {c.booked.map((b) => (
              <li key={b.names}>
                <span className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-zebra-950">{b.names}</span>
                  <span className="tabular-nums text-zebra-950">{money(b.value)}</span>
                </span>
                <span className="block text-zebra-500">{b.how}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-zebra-500">No bookings from it yet.</p>
        )}
      </section>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto_3rem] gap-x-3 gap-y-2 type-body">
        {funnel.map(([label, n]) => (
          <div key={label} className="contents">
            <dt className="text-zebra-500">{label}</dt>
            <dd className="text-right tabular-nums text-zebra-950">{n}</dd>
            <dd className="text-right tabular-nums text-zebra-400">{label === 'Delivered' ? '' : `${pct(n, c.delivered) ?? 0}%`}</dd>
          </div>
        ))}
      </dl>
      {c.warm.length ? (
        <section aria-labelledby="campaign-warm" className="space-y-3">
          <h3 id="campaign-warm" className="type-subheading text-zebra-950">
            Opened, not booked
          </h3>
          <ul className="space-y-4">
            {c.warm.map((w) => (
              <li key={w.names} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 type-body">
                  <span className="block truncate text-zebra-950">{w.names}</span>
                  <span className="block text-zebra-500">{w.did}</span>
                </span>
                <Swap
                  active={state.followed.has(w.names) ? 'done' : 'act'}
                  className="justify-items-end"
                  states={{
                    act: (
                      <Button variant="secondary" onClick={() => state.followUp(w.names)}>
                        Follow up
                      </Button>
                    ),
                    done: (
                      <Badge size="control" tone="brand">
                        <DrawnCheck className="size-3.5" />
                        Followed up
                      </Badge>
                    ),
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
