import type { StepMeta } from './steps-meta';

/**
 * Step titles and intros that use what the MC has told us, so later
 * steps read "Jane Doe MC's brand" instead of a generic label.
 * Falls back to the plain copy until a business name exists.
 *
 * @module app/design-system/v2/pages/onboarding/personalise
 */
export function personalise(step: number, meta: StepMeta, business: string): { title: string; intro?: string } {
  const b = business.trim();
  if (!b) return meta.intro ? { title: meta.title, intro: meta.intro } : { title: meta.title };
  switch (step) {
    case 4:
      return { title: `${b}'s brand`, intro: meta.intro ?? '' };
    case 5:
      return { title: meta.title, intro: `Signed once, then applied to every contract ${b} sends. Couples sign theirs online, on any phone.` };
    case 6:
      return { title: `Watch ${b} get booked`, intro: meta.intro ?? '' };
    case 2:
      return { title: `Build ${b}'s Zebri`, intro: meta.intro ?? '' };
    case 7:
      return { title: `Choose a plan for ${b}`, intro: meta.intro ?? '' };
    default:
      return meta.intro ? { title: meta.title, intro: meta.intro } : { title: meta.title };
  }
}
