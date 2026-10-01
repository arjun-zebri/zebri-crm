/**
 * The onboarding steps: their rail label, title, intro and time
 * budget. Copy matches the live flow on `feature/onboarding`
 * (`lib/onboarding/progress.ts`).
 *
 * @module app/design-system/v2/pages/onboarding/steps-meta
 */

/** One step's copy and its time budget in minutes. */
export interface StepMeta {
  railLabel: string;
  title: string;
  intro?: string;
  minutes: number;
  /**
   * The step's body runs to the panel's edges and fills its height
   * (the brand step's canvas and sidebar), instead of sitting in the
   * centred reading measure.
   */
  bleed?: boolean;
  /**
   * Centre the step in the panel, both ways, title included: a short
   * note that should sit in the middle rather than read as a form.
   */
  center?: boolean;
}

/** Every step, in order. Step numbers are 1-based indexes into this. */
export const STEPS: readonly StepMeta[] = [
  { railLabel: 'About you', title: 'Tell us about you', minutes: 1.5 },
  {
    railLabel: 'Build your Zebri',
    title: 'Build your Zebri',
    intro: 'Pick the tools you will use and plug in the apps you already have. Only what you add shows up.',
    minutes: 2,
  },
  { railLabel: 'What you sell', title: 'What do you charge?', minutes: 1.5 },
  { railLabel: 'Your brand', title: 'Your brand', intro: 'A starting look for every proposal, contract and invoice. Like Canva, you can change every part of it later, down to each block.', minutes: 1.5, bleed: true },
  {
    railLabel: 'Your signature',
    title: 'Add your signature',
    intro: 'Signed once, then applied to every contract you send. Couples sign theirs online, on any phone.',
    minutes: 1,
  },
  {
    railLabel: 'Watch it book',
    title: 'Watch it book a wedding',
    intro: 'A new enquiry to a paid deposit, in your brand. Sit back, it takes under a minute.',
    minutes: 0.5,
  },
  { railLabel: 'Choose your plan', title: 'Choose your plan', intro: 'A week free on Pro or Max. Change or cancel whenever you like.', minutes: 0.5 },
  { railLabel: 'A note from the founder', title: 'A note from the founder', minutes: 0.5, center: true },
];

/** How many steps there are. Never hardcode the count. */
export const TOTAL_STEPS = STEPS.length;

/** "About N minutes left" from this step to the end, or "Nearly done". */
export function timeLeftLabel(step: number): string {
  const left = STEPS.slice(step - 1).reduce((sum, s) => sum + s.minutes, 0);
  return left <= 1 ? 'Nearly done' : `About ${Math.ceil(left)} minutes left`;
}
