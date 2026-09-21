'use client';

/**
 * State machine for the "New template" flow (founder's ask, UX audit
 * §3.8-3.9): New template -> choose Start from scratch / Use a template
 * -> (scratch: straight to naming; gallery: pick a starter, then name it)
 * -> Create. Pulled out of `templates-list.tsx` to keep that file an
 * orchestrator and this the one place the step order lives.
 *
 * @module app/(dashboard)/proposals/templates/use-new-template-flow
 */
import { useState } from 'react';

import type { TemplateStarter } from '@/features/proposals';

/** One step of the New template flow. */
export type NewTemplateStep = 'closed' | 'choose' | 'gallery' | 'name';

/** Return shape of {@link useNewTemplateFlow}. */
export interface UseNewTemplateFlowReturn {
  /** Which modal (if any) is open. */
  step: NewTemplateStep;
  /** The starter chosen in the gallery, or `null` for "Start from scratch". */
  starter: TemplateStarter | null;
  /** Opens the flow at the first choice. */
  open: () => void;
  /** Closes the flow entirely, discarding any in-progress choice. */
  close: () => void;
  /** "Start from scratch": skips the gallery and goes straight to naming. */
  chooseScratch: () => void;
  /** "Use a template": opens the gallery. */
  chooseGallery: () => void;
  /** Gallery's Back button: returns to the first choice. */
  backToChoose: () => void;
  /** Selects (or re-selects) a starter card in the gallery, without leaving it. */
  selectStarter: (starter: TemplateStarter) => void;
  /** Gallery's "Use this template": moves to naming with the selected starter. */
  confirmStarter: () => void;
}

/** Drives the New template modal sequence. See {@link UseNewTemplateFlowReturn}. */
export function useNewTemplateFlow(): UseNewTemplateFlowReturn {
  const [step, setStep] = useState<NewTemplateStep>('closed');
  const [starter, setStarter] = useState<TemplateStarter | null>(null);

  return {
    step,
    starter,
    open: () => {
      setStarter(null);
      setStep('choose');
    },
    close: () => {
      setStep('closed');
      setStarter(null);
    },
    chooseScratch: () => {
      setStarter(null);
      setStep('name');
    },
    chooseGallery: () => setStep('gallery'),
    backToChoose: () => {
      setStarter(null);
      setStep('choose');
    },
    selectStarter: (next) => setStarter(next),
    confirmStarter: () => {
      // No-op without a selection: the gallery's "Use this template" button
      // is disabled until one is picked, but the guard keeps this callable
      // safely regardless.
      if (starter) setStep('name');
    },
  };
}
