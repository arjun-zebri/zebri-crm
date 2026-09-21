'use client'

/**
 * A content section's own background/padding/column frame around its live
 * `ContentSectionEditor`, mirroring `SectionView`'s `mode: 'edit'` chrome
 * exactly. Split out of `editable-section.tsx` (Proposal Layout v2 Phase 2
 * Task 13) to keep that file near its ~150-line budget once the mobile
 * canvas's content-column override landed here.
 *
 * @module features/proposals/editor/content-section-frame
 */
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { Section } from '../model/layout'
import type { ProposalTheme } from '../model/theme'
import { SectionBackdrop } from '../render/section-backdrop'
import { sectionCss } from '../render/section-style'

import { ContentSectionEditor } from './content-section-editor'
import type { LayoutAction } from './state'

/** Props for {@link ContentSectionFrame}. */
export interface ContentSectionFrameProps {
  section: Section
  index: number
  branding: PublicBranding
  /** The layout's canvas theme (`model/theme.ts`): default padding, step flow, and the text roles. */
  theme: ProposalTheme
  /** `LayoutEditorState.externalVersion` (`./state.ts`), passed straight through to `ContentSectionEditor` - see its module doc for what it gates. */
  externalVersion: number
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
}

/** The section's own background/padding/column frame around its live `ContentSectionEditor`, mirroring `SectionView`'s `mode: 'edit'` chrome exactly. */
export function ContentSectionFrame({ section, index, branding, theme, externalVersion, dispatch }: ContentSectionFrameProps) {
  const { section: frameStyle, column, columnClass, justifyClass } = sectionCss(section.style, 'edit', theme)
  return (
    // `grow` mirrors `render/section.tsx`: in step flow a `full` section fills its page.
    <section className={`relative flex w-full overflow-hidden ${theme.flow === 'step' && section.style.height === 'full' ? 'grow' : ''}`} style={frameStyle}>
      <SectionBackdrop background={section.style.background} index={index} mode="edit" />
      {/* `contentWidth`/`padding` stay whatever the layout stores (see
          `column`/`columnClass` above): switching device never mutates the
          section's own style, only how it is displayed. The mobile override
          below is a CSS rule keyed off the canvas root's own
          `data-canvas="mobile"` attribute (Task 13, `section-canvas.tsx`),
          not a `device` check here, so it applies with no prop threading:
          `!max-w-full` outranks the inline `style.maxWidth` a numeric
          `contentWidth` sets on `column`, because Tailwind's `!` prefix
          emits `!important` and an `!important` class always outranks a
          plain inline style. */}
      <div data-content-column data-align={section.style.align} className={`relative mx-auto flex w-full flex-col ${justifyClass} ${columnClass} [[data-canvas=mobile]_&]:!max-w-full`} style={column}>
        <ContentSectionEditor
          sectionId={section.id}
          content={section.content ?? { type: 'doc', content: [] }}
          externalVersion={externalVersion}
          branding={branding}
          theme={theme}
          textColor={section.style.textColor}
          align={section.style.align}
          onChange={(id, content) => dispatch({ type: 'setContent', id, content })}
          onFocusSection={(id) => dispatch({ type: 'select', sectionId: id })}
          onNodeSelect={(node) => dispatch({ type: 'selectNode', node })}
        />
      </div>
    </section>
  )
}
