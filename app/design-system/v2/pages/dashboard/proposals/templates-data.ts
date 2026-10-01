import type { DemoPackage } from '../../onboarding/packages';
import { INITIAL } from '../../onboarding/use-onboarding-state';

/**
 * The MC's packages and proposal templates for the v2 Proposals page.
 * Every template is the onboarding's sample proposal (`BrandProposal`)
 * in the MC's one brand, with its own headline and packages, since an
 * MC keeps a single look across templates and changes what is on offer.
 * Demo data: the real page reads the MC's own.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/templates-data
 */

/** The MC, as the proposal signs off and heads its page. */
export const MC = { business: 'Arjun Punekar MC', name: 'Arjun Punekar' };

/** The MC's brand: the onboarding's default, Zebri's own greens. */
export const BRAND = INITIAL.brand;

/** Deposit percent that holds the date. */
export const DEPOSIT = 25;

export type PackageId = 'ceremony' | 'classic' | 'premium' | 'celebrant' | 'gala';

export const PACKAGES: Record<PackageId, DemoPackage> = {
  ceremony: { name: 'Ceremony only', price: 1850, lines: ['Legal paperwork and lodgement', 'Rehearsal on site', 'PA and two mics'] },
  classic: { name: 'Classic MC', price: 3600, lines: ['Reception MC, up to six hours', 'Run sheet and supplier liaison', 'One planning meeting'] },
  premium: { name: 'Premium MC', price: 4350, lines: ['Ceremony and reception, all day', 'Run sheet, speeches coaching', 'Two planning meetings', 'Games and a trivia bracket'] },
  celebrant: { name: 'Celebrant and MC', price: 5200, lines: ['Your ceremony, written with you', 'Legal paperwork and lodgement', 'Reception MC, up to six hours'] },
  gala: { name: 'Gala host', price: 3900, lines: ['Host for up to five hours', 'Awards and auction run to time', 'Briefing with your events team'] },
};

export type TemplateId = 'full-day' | 'ceremony' | 'celebrant' | 'gala';

/** A template: its name, what it opens with, and what it offers. */
export interface Template {
  id: TemplateId;
  name: string;
  /** One line on when to use it, under the name. */
  use: string;
  headline: string;
  packages: PackageId[];
  /** The sample couple its preview shows. */
  sample: { couple: string; greet: string; venue: string };
}

export const TEMPLATES: Template[] = [
  { id: 'full-day', name: 'Full day MC', use: 'Ceremony to last dance, the one most couples get', headline: 'Your day, beautifully run', packages: ['premium', 'classic'], sample: { couple: 'Sarah & Tom', greet: 'Sarah and Tom', venue: 'Stones of the Yarra Valley' } },
  { id: 'ceremony', name: 'Ceremony only', use: 'For couples with a friend on the mic at the reception', headline: 'A ceremony that feels like you', packages: ['ceremony'], sample: { couple: 'Ava & Finn', greet: 'Ava and Finn', venue: 'Royal Botanic Garden' } },
  { id: 'celebrant', name: 'Celebrant + MC', use: 'One voice from the vows to the speeches', headline: 'One voice from “I do” to the last dance', packages: ['celebrant', 'premium'], sample: { couple: 'Ruby & Kai', greet: 'Ruby and Kai', venue: 'The Boathouse Palm Beach' } },
  { id: 'gala', name: 'Corporate gala', use: 'End of year parties, awards nights and fundraisers', headline: 'An evening that runs to the minute', packages: ['gala'], sample: { couple: 'Harbour Bank Gala', greet: 'the Harbour Bank team', venue: 'Doltone House' } },
];

/** A template by id; every id in the data has one. */
export const templateOf = (id: TemplateId) => TEMPLATES.find((t) => t.id === id)!;

/** The packages a template offers, in order. */
export const packagesOf = (t: Template) => t.packages.map((p) => PACKAGES[p]);
