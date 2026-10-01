import { CalendarCheck } from 'lucide-react';

import { WEDDING } from '../brand-doc-parts';

import { CLIENT } from './replay-data';
import { CardTitle, Dot, Eyebrow, Reveal, Row, Strip, type Beat } from './replay-parts';

/**
 * The replay's opening scenes: the enquiry landing, Zebri turning it
 * into a lead, and the instant reply with open times.
 *
 * @module app/design-system/v2/pages/onboarding/replay/cards-enquiry
 */

/** 1. The couple's email, as it lands. */
export function EnquiryCard() {
  return (
    <>
      <Eyebrow>New enquiry</Eyebrow>
      <div className="mt-5 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-pill bg-[var(--b-soft)] type-label text-[var(--b-primary)]">
          {CLIENT.initials}
        </span>
        <div>
          <p className="type-label text-zebra-950">{CLIENT.name}</p>
          <p className="type-body text-zebra-500">{CLIENT.email}</p>
        </div>
      </div>
      <CardTitle className="mt-5">Our wedding, 12 March 2027</CardTitle>
      <p className="mt-3 type-body text-zebra-600">
        Hi! We&rsquo;re getting married at Stones of the Yarra Valley and would love an MC who keeps the night moving. Are
        you free?
      </p>
      <p className="mt-3 type-body text-zebra-600">Sarah &amp; Tom</p>
    </>
  );
}

/** 2. The lead, filled from the email one field at a time, with the date checked against the MC's calendar. */
export function LeadCard({ on }: { on: Beat }) {
  const fields = [
    { label: 'Email', value: CLIENT.email },
    { label: 'Wedding', value: 'Sat 12 Mar 2027' },
    { label: 'Venue', value: WEDDING.venue },
  ];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>New lead</Eyebrow>
        <Reveal on={on(2)}>
          <span className="rounded-pill bg-[var(--b-soft)] px-2.5 py-1 type-body text-[var(--b-primary)]">New</span>
        </Reveal>
      </div>
      <CardTitle className="mt-3">{WEDDING.couple}</CardTitle>
      <div className="mt-4">
        {fields.map((f, i) => (
          <Row key={f.label} label={f.label}>
            <Reveal on={on(0)} className={`truncate text-zebra-950 ${['', 'delay-150', 'delay-300'][i]}`}>
              {f.value}
            </Reveal>
          </Row>
        ))}
        <Row label="Source" last>
          <Reveal on={on(0)} className="text-zebra-950 delay-450">
            Website enquiry
          </Reveal>
        </Row>
      </div>
      <Reveal on={on(1)} className="mt-4">
        <span className="inline-flex items-center gap-2 rounded-pill bg-[var(--b-primary)] px-3 py-1.5 type-body text-[var(--b-on-primary)]">
          <CalendarCheck aria-hidden="true" strokeWidth={1.5} className="size-4" />
          The 12th is free in your calendar
        </span>
      </Reveal>
      <Strip>
        <Reveal on={on(3)} className="flex items-center gap-2.5 type-body text-zebra-600">
          <Dot />
          Added to Couples. Nothing typed.
        </Reveal>
      </Strip>
    </>
  );
}

const SLOTS = ['Wed 3:00 pm', 'Wed 5:30 pm', 'Thu 10:00 am', 'Thu 4:30 pm', 'Fri 11:00 am', 'Fri 2:00 pm'];
const PICKED = 'Thu 4:30 pm';

/** 3. The reply from the MC's address: thanks, the good news, and six open times; Sarah taps one. */
export function AvailabilityCard({ on }: { on: Beat }) {
  return (
    <>
      <Eyebrow>Sent from your address</Eyebrow>
      <p className="mt-2 type-body text-zebra-500">To {CLIENT.name}</p>
      <CardTitle className="mt-4">You&rsquo;re in luck, the 12th is free</CardTitle>
      <p className="mt-3 type-body text-zebra-600">
        Hi {CLIENT.first}, thank you for reaching out, and congratulations! Pick a time for a quick video call and
        we&rsquo;ll plan the night together.
      </p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {SLOTS.map((slot) => {
          const picked = slot === PICKED && on(1);
          return (
            <span
              key={slot}
              className={`rounded-button border py-3 text-center type-body transition-[background-color,border-color,color,scale,box-shadow] duration-300 motion-reduce:transition-none ${
                picked
                  ? 'scale-103 border-[var(--b-primary)] bg-[var(--b-primary)] text-[var(--b-on-primary)] shadow-[0_0_0_4px_var(--b-soft)]'
                  : 'border-zebra-200 text-zebra-950'
              }`}
            >
              {slot}
            </span>
          );
        })}
      </div>
      <Strip>
        <Reveal on={on(2)} className="flex items-center gap-2.5 type-body text-zebra-600">
          <Dot />
          {CLIENT.first} booked Thursday 4:30 pm. Call link sent.
        </Reveal>
      </Strip>
    </>
  );
}
