'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';

import { JOURNEYS, type JourneyStep } from './pages/dashboard/journeys/journeys-data';
import { StepDialog } from './pages/dashboard/journeys/step-dialog';
import { Group, Spec } from './showroom-v2';

/**
 * Step dialog: the journey step as a side peek, opened on the Full
 * weddings proposal step. The settings work; Open editor does nothing.
 *
 * @module app/design-system/v2/components-step-document
 */

const JOURNEY = JOURNEYS[0]!;
const STEP = JOURNEY.steps.find((s) => s.kind === 'proposal') ?? JOURNEY.steps[0]!;

/** The Step dialog group. */
export function ComponentsStepDocumentV2() {
  const [step, setStep] = useState<JourneyStep | null>(null);
  return (
    <Group id="step-document" title="Step dialog">
      <Spec
        name="Side peek"
        file="app/design-system/v2/pages/dashboard/journeys/step-dialog.tsx"
        description="The real document on the left at half size, scrolling the whole way, with Open editor over it; the settings in a slim panel on the right: the document card, then When, Sent by and Follow-ups, each a label over its value. Large and fixed in height. On a phone the panel fills the screen and an eye shows the page."
      >
        <Button variant="secondary" onClick={() => setStep(STEP)}>
          Open step dialog
        </Button>
        <StepDialog journey={JOURNEY} step={step} onChange={setStep} onEdit={() => {}} onRemove={() => setStep(null)} onClose={() => setStep(null)} />
      </Spec>
    </Group>
  );
}
