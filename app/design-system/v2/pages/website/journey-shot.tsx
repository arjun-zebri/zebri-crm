'use client';

import { useRef, useState } from 'react';

import { BdmIcon, ContractIcon, EmailIcon, InvoiceIcon, ProposalIcon } from '@/components/ui-v2/icons';
import { SwipeRow } from '@/components/ui-v2/swipe-row';

import { STEP_SCENES } from './journey-docs';
import { JourneySlide } from './journey-slide';
import { JourneyStage } from './journey-stage';
import { JourneyStep, STEP_MS, type Line, type ShotStep } from './journey-step';
import { usePlayed } from './use-played';

/**
 * The Journeys band's picture, the full width of the page, on the brand
 * gradient: the journey's steps on the left, straight on the gradient,
 * and on the right one container shaped like the couple's record, with
 * what the step on the stage sent at real size (`journey-stage.tsx`).
 * The steps tick off on their own as the band scrolls into view; the
 * rail between them is the clock to the next tick, and the step on the
 * stage lifts into a white card with a line on what it does
 * (`journey-step.tsx`). A done step can be clicked to put its document
 * back on the stage; the journey keeps ticking. Founder reviews,
 * 2026-10-18: the steps out of their container and more detailed, the
 * content in one shadowed container, "really push yourself".
 *
 * It sells the outcome ("it happens without you"), so it shows a
 * booking moving, not the journey editor (2026-10-17 review). The NOIM
 * is received and checked before the day; lodgement with BDM is after
 * it, so its step says Checked, not Lodged.
 *
 * It plays the whole booking, through the Notice of Intended Marriage
 * and the paid balance, each with its own screen (founder, 2026-10-19:
 * "why is there no screen for the notice or the balance invoice"; it
 * had stopped on the deposit so the BDM band would not repeat the
 * notice).
 *
 * The server renders the finished state, so a visitor without script or
 * with reduced motion sees the whole story, on the paid balance. After
 * hydration, a band that starts below the fold is reset before it is
 * ever seen and plays once when it comes into view. Below `lg` there is
 * no separate stage: each step is one card with its screen
 * (`JourneySlide`), in a `SwipeRow` that follows the step playing.
 *
 * @module app/design-system/v2/pages/website/journey-shot
 */

/** DEMO CONTENT: a Celebrant's starter journey, as one couple meets it. */
export const SHOT_STEPS: ShotStep[] = [
  {
    icon: EmailIcon,
    name: 'Thank-you email',
    when: 'As soon as they enquire',
    detail: 'A warm reply in your words, so they hear from you before anyone else.',
    done: 'Sent',
    event: 'Sent for you, 2 minutes after Mia enquired',
    at: 'Mon 7 Sep, 4:14 pm',
  },
  {
    icon: ProposalIcon,
    name: 'Proposal',
    when: '20 minutes later',
    detail: 'Your ceremony package and price in your brand, ready to accept online.',
    done: 'Accepted',
    event: 'Accepted by Mia the next morning',
    at: 'Tue 8 Sep, 8:05 am',
  },
  {
    icon: ContractIcon,
    name: 'Contract',
    when: 'When they accept',
    detail: 'Your agreement, filled in with their details and signed online by all three of you.',
    done: 'Signed',
    event: 'Signed by Jess, Mia and Leo',
    at: 'Wed 9 Sep',
  },
  {
    icon: InvoiceIcon,
    name: 'Deposit invoice',
    when: 'When they sign',
    detail: 'A $500 deposit to hold the date, paid by card. They are booked the moment it clears.',
    done: 'Paid',
    event: 'Paid by card. Mia and Leo are booked',
    at: 'Wed 9 Sep',
  },
  {
    icon: BdmIcon,
    name: 'Notice of Intended Marriage',
    when: 'Once they are booked',
    detail: 'They fill it in on their phone, and every answer is checked against BDM’s rules.',
    done: 'Checked',
    event: 'Every answer checked, well before the one-month cut-off',
    at: 'Tue 15 Sep',
  },
  {
    icon: InvoiceIcon,
    name: 'Balance invoice',
    when: '14 days before the wedding',
    detail: 'The $1,500 balance, sent and followed up for you.',
    done: 'Paid',
    event: 'Paid in full',
    at: 'Sat 27 Feb',
  },
];

/** How many steps have happened by the end: all of them, the balance paid. */
const DONE = SHOT_STEPS.length;
/** The step after which the couple is booked: the deposit. */
const BOOKED_AT = 4;

/** The line from step `i` to the next: drawn once the next is done, the clock while it is coming. */
function lineOf(i: number, played: number): Line {
  if (i + 1 < played) return 'full';
  return i === played - 1 && played < DONE ? 'timer' : 'empty';
}

/** One couple's journey, ticking off, with what each step sent on the stage beside it. */
export function JourneyShot() {
  const ref = useRef<HTMLDivElement>(null);
  const played = usePlayed(ref, DONE, STEP_MS);
  // A step the visitor clicked holds the stage until the journey ticks on.
  const [picked, setPicked] = useState<{ step: number; at: number } | null>(null);
  const shown = picked && picked.at === played ? picked.step : played - 1;
  return (
    // Straight on the band's grey, no gradient box (founder, 2026-10-19): the record floats on its shadow.
    <div ref={ref}>
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_42.5rem] lg:gap-12">
        {/* Phones and tablets: each step one card, its screen under it, swiped sideways and
            kept on the step playing (founder, 2026-10-19: not a step card over a separate
            record). min-w-0: a grid item would otherwise widen to all six and never scroll. */}
        <div className="min-w-0 lg:hidden">
          <SwipeRow aria-label="Mia and Leo's journey" until="lg" ordered current={Math.max(shown, 0)}>
            {SHOT_STEPS.map((step, i) => (
              <JourneySlide key={step.name} step={step} index={i} done={i < played} />
            ))}
          </SwipeRow>
        </div>
        {/* min-w-0: the stage is laid out 680px wide inside, and a grid item would grow to it. */}
        <div className="min-w-0 max-lg:hidden lg:order-2">
          <JourneyStage shown={shown} booked={played >= BOOKED_AT} events={SHOT_STEPS.map((s) => ({ text: s.event, when: s.at }))} />
        </div>
        <ol aria-label="Mia and Leo's journey" className="min-w-0 space-y-1 max-lg:hidden">
          {SHOT_STEPS.map((step, i) => (
            <JourneyStep
              key={step.name}
              step={step}
              done={i < played}
              lit={i === shown}
              open={i === Math.max(shown, 0)}
              line={i === SHOT_STEPS.length - 1 ? null : lineOf(i, played)}
              onShow={i < played && STEP_SCENES[i] ? () => setPicked({ step: i, at: played }) : undefined}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
