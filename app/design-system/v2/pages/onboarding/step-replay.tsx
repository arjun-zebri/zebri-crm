'use client';

import type { ReactNode } from 'react';

import { brandVars } from './brand-doc-parts';
import type { DemoPackage } from './packages';
import { InvoiceCard, PaidCard, SignedCard } from './replay/cards-booked';
import { CallCard } from './replay/cards-call';
import { AvailabilityCard, EnquiryCard, LeadCard } from './replay/cards-enquiry';
import { AcceptCard, ContractCard, ProposalCard } from './replay/cards-proposal';
import { STEPS, replayData } from './replay/replay-data';
import { Card } from './replay/replay-parts';
import { ReplayStory } from './replay/replay-story';
import { useReplayClock } from './replay/use-replay-clock';
import type { Brand, Signature } from './use-onboarding-state';

/**
 * Step 6, the aha: a booking going through Zebri's workflow, ten scenes
 * from a new enquiry on Tuesday to a paid deposit on Friday, played
 * once in about fifty seconds, as one big animation. Each step is a
 * scene: told in large type on the left (when, who did what, what it
 * means), shown on the right as the artifact the couple or the MC would
 * see (an email, the call, the proposal, the contract, the invoice) in
 * the MC's own brand, packages, prices and signature.
 *
 * The flow remounts it each visit, so it always starts from the top,
 * and it only runs while it is the step on screen.
 *
 * @module app/design-system/v2/pages/onboarding/step-replay
 */

export interface StepReplayProps {
  active: boolean;
  business: string;
  name: string;
  brand: Brand;
  signature: Signature;
  packages: DemoPackage[];
  deposit: number;
}

export function StepReplay({
  active,
  business,
  name,
  brand,
  signature,
  packages,
  deposit,
}: StepReplayProps) {
  const clock = useReplayClock(active);
  const { step, on } = clock;
  const d = replayData({ business, name, logoUrl: brand.logoUrl, signature, packages, deposit });
  const beat = (i: number) => (k: number) => on(i, k);

  const cards: { tone?: 'tight' | 'bleed' | 'brand'; node: ReactNode }[] = [
    { node: <EnquiryCard /> },
    { node: <LeadCard on={beat(1)} /> },
    { node: <AvailabilityCard on={beat(2)} /> },
    { tone: 'tight', node: <CallCard on={beat(3)} /> },
    { tone: 'bleed', node: <ProposalCard on={beat(4)} d={d} /> },
    { node: <AcceptCard on={beat(5)} d={d} /> },
    { node: <ContractCard on={beat(6)} d={d} /> },
    { node: <SignedCard on={beat(7)} d={d} /> },
    { node: <InvoiceCard on={beat(8)} d={d} /> },
    { tone: 'brand', node: <PaidCard on={beat(9)} d={d} /> },
  ];

  return (
    // The brand rides in on custom properties: runtime data, so the one style.
    // One stage: the story told big on the left, the artifact on the right;
    // stacked on phones, story first.
    <div
      style={brandVars(brand)}
      className="flex flex-col gap-6 rounded-panel bg-zebra-100 p-5 sm:p-7 lg:h-[32rem] lg:flex-row lg:gap-8"
    >
      <div className="lg:w-60 lg:shrink-0">
        <ReplayStory clock={clock} />
      </div>
      {/* flex-1 only beside the story: in a column it zeroes the height. */}
      <div className="relative h-[30rem] min-w-0 shrink-0 lg:h-auto lg:flex-1">
        {cards.map((c, i) => (
          <Card key={STEPS[i]?.label} at={i} step={step} {...(c.tone ? { tone: c.tone } : {})}>
            {c.node}
          </Card>
        ))}
      </div>
    </div>
  );
}
