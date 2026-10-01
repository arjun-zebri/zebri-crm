import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { BrandButton, SAMPLE_PACKAGE, WEDDING, aud, depositOf, type Wedding } from './brand-doc-parts';
import type { DemoPackage } from './packages';
import { PhotoTile } from './proposal-media';

/**
 * The content sections of the brand step's sample proposal, in the
 * order a couple reads it: how it works, the packages, a couple's
 * words, and the accept block. Laid out like a Qwilr page: generous
 * air, one idea per section, left-aligned text, the brand colour saved
 * for the eyebrows, the numbers and the actions.
 *
 * @module app/design-system/v2/pages/onboarding/proposal-sections
 */

/** A section's small brand-coloured eyebrow over its heading. */
export function SectionHead({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="type-eyebrow text-[var(--b-primary)] transition-colors duration-500">{eyebrow}</p>
      <h3 className="type-title text-zebra-950 font-[family-name:var(--b-heading)]">{children}</h3>
    </div>
  );
}

const STEPS = [
  { title: 'We meet', body: 'A relaxed call to hear your story and how you picture the night.' },
  { title: 'We plan', body: 'Your run sheet, names and cues, shared with your venue and suppliers.' },
  { title: 'You celebrate', body: 'I run the room so you can be present for every moment.' },
];

/** Three numbered steps from booking to the day, then a gallery of past weddings. */
export function HowItWorks() {
  return (
    <div className="space-y-6">
      <SectionHead eyebrow="How it works">From yes to the last dance</SectionHead>
      <ol className="space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="w-6 shrink-0 type-heading text-[var(--b-primary)] font-[family-name:var(--b-heading)] transition-colors duration-500">
              {i + 1}
            </span>
            <span className="space-y-0.5">
              <span className="block type-subheading text-zebra-950 font-[family-name:var(--b-heading)]">{s.title}</span>
              <span className="block type-body text-zebra-500">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      {/* A mosaic, one lead photo and two beside it, as a gallery block lays out. */}
      <div className="grid h-52 grid-cols-3 grid-rows-2 gap-2">
        <PhotoTile deep label="Wedding photo one" className="col-span-2 row-span-2" />
        <PhotoTile label="Wedding photo two" />
        <PhotoTile label="Wedding photo three" />
      </div>
    </div>
  );
}

/**
 * The MC's packages, stacked (up to two, or a sample when they skipped
 * the step): name and price on one line, what's included, and a Choose
 * button. The first wears the accent wash, so the page has one clear
 * recommendation; the second is a quiet outlined card.
 */
export function Packages({ packages }: { packages: DemoPackage[] }) {
  const shown = (packages.length ? packages : [SAMPLE_PACKAGE]).slice(0, 2);
  return (
    <div className="space-y-6">
      <SectionHead eyebrow="Your investment">Choose your package</SectionHead>
      <ul className="space-y-3">
        {shown.map((p, i) => (
          <li
            key={p.name}
            // On the accent wash, text takes the accent's readable colour
            // (light on a dark accent); the outlined card stays dark on white.
            className={`space-y-4 rounded-check p-5 transition-colors duration-500 ${i === 0 ? 'bg-[var(--b-secondary)] text-[var(--b-on-secondary)]' : 'border border-zebra-200 text-zebra-950'}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="type-heading font-[family-name:var(--b-heading)]">{p.name}</p>
              <p className="type-numeric">{aud(p.price)}</p>
            </div>
            {p.lines.length ? (
              <ul className="space-y-1.5">
                {p.lines.map((line) => (
                  <li key={line} className="flex items-start gap-2 type-body opacity-80">
                    <Check aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
            <BrandButton>Choose this package</BrandButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A past couple's words: a pull quote between hairlines, no box. */
export function Testimonial() {
  return (
    <figure className="space-y-4 border-y border-zebra-200 py-8 text-center">
      <blockquote className="type-heading text-zebra-950 font-[family-name:var(--b-heading)]">
        &ldquo;Every guest asked who our MC was. The night ran like clockwork and still felt completely like us.&rdquo;
      </blockquote>
      <figcaption className="type-body text-zebra-500">Emma &amp; James, married at Montsalvat</figcaption>
    </figure>
  );
}

/** The close: the date to hold, the deposit that holds it, and the one action. */
export function Accept({ packages, deposit, wedding = WEDDING }: { packages: DemoPackage[]; deposit: number; wedding?: Wedding }) {
  const pkg = packages[0] ?? SAMPLE_PACKAGE;
  return (
    <div className="space-y-5 text-center">
      <SectionHead eyebrow="Next step">Let&rsquo;s lock in your date</SectionHead>
      <p className="mx-auto max-w-xs type-body text-zebra-500">
        Accept online and pay a {deposit}% deposit of {aud(depositOf(pkg.price, deposit))} to hold {wedding.date}.
      </p>
      <div className="mx-auto max-w-xs">
        <BrandButton>Accept and hold our date</BrandButton>
      </div>
    </div>
  );
}
