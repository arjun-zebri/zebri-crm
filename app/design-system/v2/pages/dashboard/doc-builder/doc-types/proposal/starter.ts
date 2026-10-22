import { doc, heading, paragraph, text, variable } from '@/features/proposals';
import type { SectionData } from '@/features/proposals';

import type { DemoPackage } from '../../../../onboarding/packages';
import type { Template } from '../../../proposals/templates-data';
import { BRAND_COLOUR, BRAND_DEEP } from '../../look/brand-vars';
import { resolveSection } from '../../model/resolve-variables';
import type { DocLayout, DocSection } from '../../model/types';

import { STARTER_COPY } from './starter-copy';
import { filledSection, NEAR, styled, TIGHT, words } from './starter-sections';
import { readTemplate } from './template-store';

export { filledSection } from './starter-sections';

/**
 * The page a new proposal starts as, per template, in the original
 * onboarding proposal's order: the business's name as a header, a cover
 * in the MC's brand colour with the couple's names, a personal welcome
 * signed by the MC, a video hello, how it works, the packages under a
 * heading, kind words, and the accept. No photography: the original
 * onboarding proposal (`onboarding/brand-proposal.tsx`) was the brand
 * itself, and photos from the demo library put the founder's own
 * wedding on every template (founder, 2026-10-08: "it used to look way
 * better before"). The MC adds their own photos from their brand kit. A template keeps the couple's name, date and venue as
 * chips; a proposal gets them as words (no chips on a couple's page,
 * 2026-10-04 audit). Every text section shares one column width, so the left edges line
 * up (2026-10-04 audit). Built from production's own section model, so
 * the editor and the couple's page render it with the real engine.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/starter
 */

/** Who a proposal is from: what a template knows before any couple. */
export interface StarterFrom {
  mc: string;
  role: string;
  business: string;
  /** "Arjun Punekar MC · 0412 555 018 · ABN 51 824 753 556", the page's sign-off; empty leaves it off. */
  footer: string;
  /** The MC's brand colour (`#rrggbb`), which the cover is drawn in; Zebri's own when they have none. */
  brand?: string | undefined;
}

/** Who the proposal is for and who it is from. */
export interface StarterFor extends StarterFrom {
  couple: string;
  date: string;
  venue: string;
}

/**
 * The couple's details a template leaves as chips, as one couple's words.
 * The date stays as the page writes it ("Sat 14 Mar 2027").
 */
export const coupleValues = (who: Pick<StarterFor, 'couple' | 'date' | 'venue'>): Record<string, string> => ({
  couple_name: who.couple,
  event_date: who.date,
  venue: who.venue,
});

/** `layout` written for one couple: every chip in its words turned into theirs (and the business's, from `extra`). */
export function forCouple(layout: DocLayout, who: Pick<StarterFor, 'couple' | 'date' | 'venue'>, extra: Record<string, string> = {}): DocLayout {
  const values = { ...extra, ...coupleValues(who) };
  return { ...layout, sections: layout.sections.map((s) => resolveSection(s, values)) };
}

/**
 * The page a new proposal opens as: the template as the MC last edited
 * it, else Zebri's own, written for this couple. Templates and
 * proposals share one source, so editing a template changes every
 * proposal started from it afterwards (never the ones already going).
 */
export function starterLayout(template: Template, who: StarterFor, packages: DemoPackage[], extra: Record<string, string> = {}, key: string = template.id): DocLayout {
  return forCouple(readTemplate(key)?.layout ?? templateLayout(template, who, packages), who, extra);
}

/** The original page's quiet grey, for the words under a heading. */
const MUTED = '#71716b';

/** `value` as the original page's small brand-colour eyebrow over a heading. */
const eyebrowOf = (value: string) =>
  paragraph(text(value.toUpperCase(), [{ type: 'textStyle', attrs: { color: BRAND_COLOUR, fontSize: '12px', letterSpacing: '0.12em', fontWeight: '600' } }]));

/** Words in the original page's grey. */
const muted = (value: string) => text(value, [{ type: 'textStyle', attrs: { color: MUTED } }]);

/**
 * Zebri's own page for `template`, built to read as the original
 * onboarding proposal (`onboarding/brand-proposal.tsx`; founder,
 * 2026-10-08: "it used to look way better"): the business as a header, a
 * brand-colour cover, then each section under a small brand-colour
 * eyebrow. A welcome signed by the MC, a video hello and a photo mosaic
 * (empty slots until they add their own, which the couple's page leaves
 * out), how it works as a numbered list, the packages stacked with
 * "Choose this package", one couple's words between rules, and "Let's
 * lock in your date". No questions: the original had none, and the MC
 * can add them. The couple's name, date and venue are chips, filled in
 * when a proposal starts from it.
 */
export function templateLayout(template: Template, who: StarterFrom, packages: DemoPackage[]): DocLayout {
  const copy = STARTER_COPY[template.id];
  // Brand colours as the page's variables (`look/brand-vars.ts`), so the page follows "Your brand" live.
  const eyebrow = eyebrowOf;
  // A numbered list, so the numbers are in the text face: in a display
  // heading face they read badly (Italiana's 3 looks like a ʒ, 2026-10-10).
  const steps = {
    type: 'orderedList',
    content: copy.steps.map(([title, body]) => ({ type: 'listItem', content: [paragraph(text(title, [{ type: 'bold' }])), paragraph(muted(body))] })),
  };
  const fill = (kind: SectionData['kind']) => filledSection(kind, template, packages);
  const sections: DocSection[] = [
    // The page's own header, as the MC's site would carry it.
    // A slim band: the name is all it holds (2026-10-10 review: it sat in
    // 140px of white).
    words('Header', doc(heading(3, text(who.business || who.mc))), { padding: 12, contentWidth: 'wide' }),
    // A cover band, not a full screen: the original's sat about a third of a page tall.
    words('Cover', doc(paragraph(text('A proposal for')), heading(1, variable('couple_name')), paragraph(variable('event_date'), text(' · '), variable('venue'))), {
      padding: 120,
      textColor: '#ffffff',
      background: { color: BRAND_DEEP },
    }),
    words(
      'Welcome',
      doc(
        eyebrow('Welcome'),
        heading(2, text(template.headline)),
        paragraph(muted('Hi '), variable('couple_name'), muted(', thank you for thinking of me for your wedding. You will have a room full of people you love, and my job is to make every moment land, from the first entrance to the last dance.')),
        heading(3, text(who.mc)),
        paragraph(muted(`Your ${who.role}${who.business && who.business !== who.mc ? `, ${who.business}` : ''}`)),
      ),
    ),
    fill('video'),
    words('How it works', doc(eyebrow('How it works'), heading(2, text('From yes to the last dance')), steps), TIGHT),
    styled(fill('gallery'), TIGHT),
    { ...styled(fill('packages'), { ...TIGHT, contentWidth: 'medium' }), intro: doc(eyebrow('Your investment'), heading(2, text(packages.filter((p) => p.name.trim() && p.price > 0).length > 1 ? 'Choose your package' : 'Your package'))) },
    ...(copy.words.length
      ? [{ ...styled(fill('testimonials'), TIGHT), intro: doc(eyebrow('Reviews'), heading(2, text('What couples say'))) }]
      : []),
    words('Ready', doc(eyebrow('Next step'), heading(2, text('Let\u2019s lock in your date')), paragraph(muted('Accept online to hold '), variable('event_date'), muted('.'))), { align: 'center', ...NEAR }),
    styled(fill('accept'), NEAR),
    ...(who.footer ? [words('Footer', doc(paragraph(muted(who.footer))), { align: 'center', padding: 'compact' })] : []),
  ];
  return { version: 2, sections };
}
