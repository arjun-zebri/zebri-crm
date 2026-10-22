'use client';

import type { ReactNode } from 'react';

import { RichDocView, sectionCss } from '@/features/proposals';
import type { ProposalTheme, RenderMode } from '@/features/proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';

import type { DocSection } from '../model/types';
import { specFor } from '../registry/kinds';

/**
 * A section of a kind only the engine knows, drawn in the same frame
 * production draws its own in: the section's background and text colour,
 * its padding and column width from the page theme (`sectionCss`), the
 * heading above it (`intro`), then the kind's body from the registry. So
 * a Reviews section sits on the page exactly like a Packages one.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/render/engine-section
 */

export interface EngineSectionProps {
  section: DocSection;
  index: number;
  theme: ProposalTheme;
  branding: PublicBranding;
  mode: RenderMode;
  values: Record<string, string>;
  /** Drawn in place of the kind's body: the editor's own edit form of it (the Header's). */
  body?: ReactNode;
}

/** One engine section. See {@link EngineSectionProps}. */
export function EngineSection({ section, theme, branding, mode, values, body }: EngineSectionProps) {
  const { section: outer, column, columnClass, justifyClass } = sectionCss(section.style, mode, theme);
  const Body = specFor(section.kind).Body;
  const image = section.style.background?.image;
  const ctx = { branding, theme, mode, values, textColor: section.style.textColor, align: section.style.align };
  return (
    <section
      data-section-id={section.id}
      data-section-kind={section.kind}
      className={`relative flex w-full overflow-hidden ${section.hideOnMobile ? '@max-3xl/doc:hidden' : ''}`}
      // Section colours and padding are the MC's, from the theme: runtime values.
      style={{ ...outer, ...(image ? { backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }}
    >
      <div data-content-column className={`relative mx-auto flex w-full flex-col gap-6 ${justifyClass} ${columnClass}`} style={column}>
        {section.intro ? <RichDocView doc={section.intro} ctx={ctx} /> : null}
        {body ?? (Body ? <Body section={section} theme={theme} branding={branding} mode={mode} values={values} /> : null)}
      </div>
    </section>
  );
}
