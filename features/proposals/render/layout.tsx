'use client'

/**
 * The whole proposal page from a v2 layout (spec §6): resolves variables
 * once, then renders every section in order. Used by the couple's page
 * (`mode: 'page'`), the PDF path (`'print'`) and, from Phase 2, the
 * editor canvas (`'edit'`). In step flow the sections are grouped into
 * screen-tall pages at every `pageBreak` (`model/pages.ts`); everywhere
 * else the breaks are dropped and the sections render as one flat stack.
 *
 * @module features/proposals/render/layout
 */
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ButtonAction } from '../model/doc'
import type { ProposalLayout } from '../model/layout'
import { splitPages, type LayoutPage } from '../model/pages'
import { sectionLabel } from '../model/section-labels'
import { ANIMATION_SPEED_MS, resolveTheme } from '../model/theme'
import { resolveProposalVariables } from '../model/variables'

import { pageSurfaceStyle } from './page-surface'
import type { RenderMode } from './rich-doc'
import { SectionView, type SectionViewProps } from './section'
import { pageCss } from './section-style'
import { StepRail } from './step-rail'

/** Props for {@link ProposalLayoutView}. */
export interface ProposalLayoutViewProps {
  layout: ProposalLayout
  branding: PublicBranding
  doc: PublicDocData
  mode: RenderMode
  proposal?: ProposalSlotProps | undefined
  /** Receives rich-doc button actions (accept / decline / jump). */
  onAction?: ((action: ButtonAction) => void) | undefined
  /** Forwarded to a `packages` section - see `RenderPackages`'s doc comment. `false` from the template editor canvas, its Preview overlay and the thumbnail; omitted (`true`) on the real public page. */
  defaultSelection?: boolean | undefined
}

/** Everything `SectionView` takes from the layout, shared by every section. */
type SharedSectionProps = Omit<SectionViewProps, 'section' | 'index' | 'pageStart'>

/**
 * Renders a whole v2 proposal layout: one full-bleed `<section>` per layout
 * section, in order, under the layout's canvas theme (`resolveTheme` fills
 * in the Branding-seeded default for a layout saved before themes). The
 * root carries `data-flow` (the snap rule in `globals.css` keys off it)
 * and `--doc-anim-ms` (the reveal duration every section reads).
 */
export function ProposalLayoutView({ layout, branding, doc, mode, proposal, onAction, defaultSelection }: ProposalLayoutViewProps) {
  const values = resolveProposalVariables(branding, doc)
  const theme = resolveTheme(layout, branding)
  const step = theme.flow === 'step' && mode === 'page'
  const shared: SharedSectionProps = { branding, theme, doc, mode, values, proposal, onAction, defaultSelection }
  // A page with nothing on it (a leading, trailing or doubled break) would
  // be a blank screen, so it is skipped here; the editor keeps it visible.
  const pages = step ? splitPages(layout.sections).filter((p) => p.sections.length > 0) : []
  return (
    <div
      className="@container/doc [&_a]:[color:var(--doc-link)]"
      data-flow={step ? 'step' : undefined}
      style={{ ...pageSurfaceStyle(theme, branding), ['--doc-anim-ms' as string]: `${ANIMATION_SPEED_MS[theme.animation.speed]}ms` }}
    >
      {step
        ? pages.map((page, pageIndex) => (
            <PageView key={page.id} page={page} shared={shared} indexOffset={pages.slice(0, pageIndex).reduce((n, p) => n + p.sections.length, 0)} />
          ))
        : layout.sections
            .filter((section) => section.kind !== 'pageBreak')
            .map((section, index) => <SectionView key={section.id} section={section} index={index} {...shared} />)}
      {step ? <StepRail pages={pages.map((p) => ({ id: p.id, label: sectionLabel(p.sections[0]!) }))} /> : null}
    </div>
  )
}

/**
 * One step-flow page: a screen-tall snapping box (`pageCss`) whose
 * sections grow to share it. `indexOffset` keeps each section's layout
 * index global, since the reveal rule ("never the first section") and
 * the backdrop's priority read it.
 */
function PageView({ page, shared, indexOffset }: { page: LayoutPage; shared: SharedSectionProps; indexOffset: number }) {
  return (
    <div data-page-id={page.id} className="flex snap-start flex-col" style={pageCss(shared.mode)}>
      {page.sections.map((section, i) => (
        <SectionView key={section.id} section={section} index={indexOffset + i} pageStart={i === 0} {...shared} />
      ))}
    </div>
  )
}
