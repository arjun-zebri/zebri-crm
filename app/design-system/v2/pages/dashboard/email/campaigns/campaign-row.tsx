import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { shortDate } from '../../payments/dates';
import { ROW } from '../../payments/invoice-row';
import { money } from '../../payments/payments-data';
import { bookedValue, listById, type Campaign } from '../campaigns-data';
import { pct } from '../email-data';

/**
 * One campaign row on the Campaigns tab, money first: the name over who
 * it went to, then (once sent) what it booked over how many couples,
 * then the open and click rates, then when it went or goes. Drafts and
 * scheduled sends leave the result columns empty rather than showing
 * zeros. Clicking anywhere opens the campaign. On phones the parts
 * stack; from `lg` they line up in fixed columns, as on Proposals.
 *
 * @module app/design-system/v2/pages/dashboard/email/campaigns/campaign-row
 */

export interface CampaignRowProps {
  campaign: Campaign;
  onOpen: () => void;
}

/** "Sent Thu 10 Sep", "Goes Thu 1 Oct 9:00 am" or "Draft". */
export function whenOf(c: Campaign) {
  if (c.group === 'sent' && c.on) return `Sent ${shortDate(c.on)}`;
  if (c.group === 'scheduled' && c.on) return `Goes ${shortDate(c.on)} 9:00 am`;
  return 'Draft';
}

const rate = (n: number, of: number) => {
  const p = pct(n, of);
  return p === null ? '' : `${p}%`;
};

/** A campaign row. See {@link CampaignRowProps}. */
export function CampaignRow({ campaign: c, onOpen }: CampaignRowProps) {
  const sent = c.group === 'sent';
  const booked = bookedValue(c);
  return (
    <li>
      <div className={`${ROW} grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(0,1fr)_8rem_5rem_5rem_11rem]`}>
        <StretchedButton label={`Open campaign ${c.name}`} onClick={onOpen}>
          <span className="block truncate type-label text-zebra-950">{c.name}</span>
          <span className="block truncate type-body text-zebra-500">
            To {listById(c.list).name} · {c.recipients} people
          </span>
        </StretchedButton>
        <span className="flex flex-col items-end">
          {sent ? (
            <>
              <span className={`type-label tabular-nums ${booked ? 'text-grass-800' : 'text-zebra-950'}`}>{money(booked)}</span>
              <span className="type-body text-zebra-500">{c.booked.length} booked</span>
            </>
          ) : null}
        </span>
        <span className="hidden flex-col items-end lg:flex">
          {sent ? (
            <>
              <span className="type-label tabular-nums text-zebra-950">{rate(c.opened, c.delivered)}</span>
              <span className="type-body text-zebra-500">opened</span>
            </>
          ) : null}
        </span>
        <span className="hidden flex-col items-end lg:flex">
          {sent ? (
            <>
              <span className="type-label tabular-nums text-zebra-950">{rate(c.clicked, c.delivered)}</span>
              <span className="type-body text-zebra-500">clicked</span>
            </>
          ) : null}
        </span>
        <span className="col-span-2 truncate type-body text-zebra-500 lg:col-span-1 lg:text-right">{whenOf(c)}</span>
      </div>
    </li>
  );
}
