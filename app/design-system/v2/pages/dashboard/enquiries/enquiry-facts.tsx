import { Badge } from '@/components/ui-v2/badge';

import { agoText, type Enquiry } from '../demo-activity';

import { sourceLabel, type Availability } from './enquiries-data';

/**
 * The enquiry modal's side column: bare label and value pairs (no
 * boxes, v2 ruling), under whether the MC is free on the date: a `Badge
 * dot`, grass "You're free that day" or amber with who has it.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/enquiry-facts
 */
export function EnquiryFacts({ enquiry: e, date }: { enquiry: Enquiry; date: Availability }) {
  const facts: [string, string][] = [
    ['Date', e.date],
    ['Venue', e.venue],
    ['Guests', String(e.guests)],
    ['Source', sourceLabel(e)],
    ['Received', agoText(e.ago)],
  ];
  return (
    <div className="space-y-6">
      <Badge dot tone={date.free ? 'grass' : 'warning'}>
        {date.free ? <>You&apos;re free that day</> : <>Booked that day · {date.with}</>}
      </Badge>
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 type-body">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-zebra-500">{label}</dt>
            <dd className="text-zebra-950">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
