'use client';

import { useEffect, useState } from 'react';

import type { PlanId } from './demo-data';
import type { DemoPackage } from './packages';

/**
 * Everything the onboarding demo remembers across steps, and saving it
 * so a reload keeps the MC's answers. A reload always opens on the cover;
 * `resumeStep` is where the cover's button then picks up.
 *
 * Saved to `localStorage` (this is a demo; the live flow saves to the
 * database). Every read and write is guarded: private windows and
 * blocked storage just mean no resume, never a crash. Only the
 * full-screen route passes a `storageKey`; the showroom preview starts
 * fresh every time.
 *
 * @module app/design-system/v2/pages/onboarding/use-onboarding-state
 */

/**
 * What step 1 collects. In the live flow `name` arrives prefilled from
 * Google sign-in; this demo has no sign-in, so it starts empty rather
 * than showing a stand-in name that reads as a fake default.
 */
export interface Profile {
  name: string;
  business: string;
  roles: string[];
  website: string;
}

/**
 * What the brand step collects: a logo, a brand colour and an accent,
 * and two fonts (labels from `FONT_LABELS`). The documents are a white
 * template, so this is all a brand needs to look finished.
 */
export interface Brand {
  primary: string;
  secondary: string;
  headingFont: string;
  bodyFont: string;
  logoUrl: string | null;
}

/**
 * How the MC signs: an image (drawn on the pad, or uploaded) as a data
 * URL, or their name typed in the signature face. Null until they sign.
 */
export type Signature = { kind: 'image'; src: string } | { kind: 'typed'; text: string } | null;

export interface OnboardingState {
  step: number;
  profile: Profile;
  brand: Brand;
  /** What step 3 sells; the brand preview and the replay show these. */
  packages: DemoPackage[];
  /** Deposit to hold a date, as a percent of the package price. */
  deposit: number;
  plan: PlanId;
  /** Step 5's signature; the step 6 replay countersigns with it. */
  signature: Signature;
  /** Catalogue ids of the blocks picked on the Blocks step: the sidebar after setup. */
  blocks: string[];
}

export const INITIAL: OnboardingState = {
  step: 0,
  profile: { name: '', business: '', roles: [], website: '' },
  brand: {
    // Zebri's own palette: grass-800, and zebra-100 (a light warm grey).
    primary: '#2f521f',
    secondary: '#f2f2ee',
    headingFont: 'Italiana',
    bodyFont: 'Inter',
    logoUrl: null,
  },
  packages: [{ name: 'Ceremony only', price: 900, lines: ['Legal paperwork', 'One meeting'] }],
  deposit: 25,
  plan: 'pro',
  signature: null,
  // The dashboard's defaults, plus Contracts: the first-run checklist
  // walks proposal, contract and invoice, so all three start added.
  blocks: ['proposals', 'contracts', 'payments', 'workflows'],
};

/**
 * The shape of what is saved. Bump it whenever `INITIAL` or the saved
 * fields change meaning, so a browser holding an older save starts
 * fresh instead of restoring stale answers (version 1 prefilled the
 * name with a stand-in "Jane Doe" that then came back on every reload;
 * version 3 moved packages into the saved state and the steps around;
 * version 5 cut the starter packages back to one; version 6 gave it two
 * inclusions; version 7 removed the workflow step, so saved step numbers
 * after 6 moved; version 9 added the Blocks step before the plan and
 * the `blocks` field; version 10 folded Blocks into step 2).
 */
const SAVE_VERSION = 10;

function read(key: string | undefined): OnboardingState | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const { v, ...saved } = JSON.parse(raw) as Partial<OnboardingState> & { v?: number };
    return v === SAVE_VERSION ? { ...INITIAL, ...saved } : null;
  } catch {
    return null;
  }
}

/** The state, a setter, the saved step to resume at (0 for none), a reset, and a way to drop the save alone. */
export function useOnboardingState(storageKey?: string) {
  // Read once, on first render. The flow is only ever rendered on the
  // client (see onboarding-client.tsx), so there is no server render
  // for this to disagree with.
  const [resumed] = useState(() => read(storageKey));
  // Every visit opens on the cover, even mid-setup: the pitch is the
  // first thing on screen, and the saved step waits behind its button.
  const [state, setState] = useState<OnboardingState>(() => (resumed ? { ...resumed, step: 0 } : INITIAL));
  const [resumeStep, setResumeStep] = useState(resumed?.step ?? 0);

  useEffect(() => {
    if (!storageKey) return;
    try {
      // A logo is an in-memory object URL that dies with the page. While
      // the cover shows, keep the saved step so a second reload still resumes.
      window.localStorage.setItem(storageKey, JSON.stringify({ v: SAVE_VERSION, ...state, step: state.step || resumeStep, brand: { ...state.brand, logoUrl: null } }));
    } catch {
      // Storage unavailable: carry on without resume.
    }
  }, [state, storageKey, resumeStep]);

  /**
   * Drops the save without touching what is on screen: finishing setup
   * leaves the page as it is (its button still spinning) until the
   * dashboard replaces it, so the cover never flashes up in between.
   */
  function forget() {
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
    } catch {
      // Nothing saved to clear.
    }
  }

  function reset() {
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
    } catch {
      // Nothing saved to clear.
    }
    setState(INITIAL);
    setResumeStep(0);
  }

  return { state, setState, resumeStep, reset, forget };
}
