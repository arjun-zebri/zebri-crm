import { Disclosure } from '@/components/ui-v2/disclosure';
import { TextLink } from '@/components/ui-v2/text-link';

import { FAQS } from './faq-data';
import { Reveal } from './reveal';

/**
 * The FAQ band: the questions a busy MC or celebrant asks before
 * switching, each opening to its answer. Split like Stripe's: the title
 * stays put on the left while the questions run down the right, so a
 * narrow list does not leave half a wide screen empty. Copy lives in
 * `faq-data.ts`. Under the title, the way to a person, offering the
 * founder (2026-10-18 page review: the column was empty below the
 * title), which stays put with it. Unboxed: the shadowed card round it
 * was removed (founder, 2026-10-19).
 *
 * @module app/design-system/v2/pages/website/site-faq
 */

/** The FAQ band. */
export function SiteFaq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[2fr_3fr] lg:gap-20">
          <header className="lg:sticky lg:top-28 lg:self-start">
            <p className="type-label text-grass-700">FAQ</p>
            <h2 id="faq-title" className="mt-3 text-balance type-site-title text-zebra-950">
              Questions, answered.
            </h2>
            <p className="mt-4 type-lead text-zebra-500">What MCs and Celebrants ask before they switch.</p>
            <div className="mt-8">
              <p className="type-label text-zebra-950">Rather talk it through?</p>
              <p className="mt-1 text-pretty type-body text-zebra-500">
                Ask the founder anything. Founding members get a free onboarding call and a dedicated account manager.
              </p>
              <p className="mt-4 type-body">
                <TextLink href="mailto:arjun@zebri.com.au">Email the founder</TextLink>
              </p>
            </div>
          </header>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {FAQS.map((f) => (
              <li key={f.q}>
                <Disclosure title={f.q}>{f.a}</Disclosure>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
