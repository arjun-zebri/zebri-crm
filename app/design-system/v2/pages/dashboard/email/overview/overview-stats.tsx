import { Stat, StatStrip } from '@/components/ui-v2/stat-strip';

import { money } from '../../payments/payments-data';
import { COLUMNS } from '../../proposals/overview/overview-stats';
import { bookedValue, type Campaign } from '../campaigns-data';
import { pct, type EmailTemplate } from '../email-data';

/**
 * The Email Overview's four figures, on the bare `StatStrip` as on the
 * Proposals and Payments Overviews, money first: what couples booked
 * after a campaign, then the open and reply rates across every email
 * sent from a template, then the unsubscribe rate across campaigns (the
 * health of the lists). Each carries the count behind it, so a
 * percentage is never read alone. Booked opens the Campaigns tab.
 *
 * @module app/design-system/v2/pages/dashboard/email/overview/overview-stats
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-AU')} ${n === 1 ? one : many}`;

export interface OverviewStatsProps {
  templates: EmailTemplate[];
  campaigns: Campaign[];
  onOpen: () => void;
}

/** The Overview's figures. See {@link OverviewStatsProps}. */
export function OverviewStats({ templates, campaigns, onOpen }: OverviewStatsProps) {
  const sent = templates.reduce((s, t) => s + t.sent, 0);
  const opened = templates.reduce((s, t) => s + t.opened, 0);
  const replied = templates.reduce((s, t) => s + t.replied, 0);
  const out = campaigns.filter((c) => c.group === 'sent');
  const bookings = out.reduce((s, c) => s + c.booked.length, 0);
  const delivered = out.reduce((s, c) => s + c.delivered, 0);
  const unsubscribed = out.reduce((s, c) => s + c.unsubscribed, 0);
  return (
    <StatStrip bare columns={COLUMNS}>
      <Stat label="Booked from email" swatch="bg-grass-900" value={money(out.reduce((s, c) => s + bookedValue(c), 0))} onClick={onOpen}>
        {plural(bookings, 'booking')} after a campaign
      </Stat>
      <Stat label="Opened" value={`${pct(opened, sent) ?? 0}%`}>
        Of {plural(sent, 'email')} sent
      </Stat>
      <Stat label="Replied" value={`${pct(replied, sent) ?? 0}%`}>
        {plural(replied, 'reply', 'replies')}, straight to your inbox
      </Stat>
      <Stat label="Unsubscribed" value={`${delivered ? ((unsubscribed / delivered) * 100).toFixed(1) : 0}%`}>
        {plural(unsubscribed, 'person', 'people')} across {plural(out.length, 'campaign')}
      </Stat>
    </StatStrip>
  );
}
