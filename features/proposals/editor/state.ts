/**
 * The layout editor's state shape and reducer: selection plus every direct
 * mutation the section list can take (add / move / duplicate / delete a
 * section, restyle it, edit its content or name). Pure and React-free, so
 * `useLayoutEditor` (`./use-layout-editor.ts`) can apply it to two separate
 * stores; see that module's docs for why.
 *
 * @module features/proposals/editor/state
 */
import type { JSONContent } from '@tiptap/core'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import type { BlockType } from '@/app/(dashboard)/branding/blocks/types'
import type { ProposalRole } from '@/lib/proposals/types'
import { toPlainJSON } from '@/lib/utils'

import { doc, paragraph } from '../model/doc'
import type { ProposalLayout, Section, SectionData, SectionKind, SectionStyle } from '../model/layout'
import { migrateProposalTreeToLayout } from '../model/migrate-v1'
import { presetSection, type PresetId } from '../model/presets'
import { LAYOUT_LIMITS } from '../model/rich-doc-spec'
import { newSectionId } from '../model/schema'
import { inheritMatchingDefaults, type ProposalTheme, type ThemeTextRole, type ThemeTextStyle } from '../model/theme'

/** A single selected node inside a section's rich doc (its TipTap type and document position), or none. */
export type NodeSelection = { sectionId: string; nodeType: string; pos: number } | null

/** What's currently selected in the editor: at most one section, and optionally one node within it. */
export interface Selection {
  sectionId: string | null
  node: NodeSelection
}

/**
 * The editor's full state: the layout being edited, the current
 * selection, and a version counter for external layout changes.
 *
 * `externalVersion` is owned and incremented by `useLayoutEditor`
 * (`./use-layout-editor.ts`), not by this module's own pure reducer - it
 * travels on this type, rather than as a separate prop, so it reaches
 * `ContentSectionEditor` through the same `state` object `SectionCanvas`
 * already threads down (`section-canvas.tsx` -> `editable-section.tsx` ->
 * `content-section-frame.tsx`). It bumps exactly on a layout change that
 * did not come from `dispatch` - undo, redo, `replaceLayout` - which is
 * the only time an open content editor may re-hydrate from `content`; see
 * `content-section-editor.tsx`'s module doc for the live bug this fixes
 * (a stale `content` prop from a sync mid-transaction re-render must
 * never reset an editor).
 */
export interface LayoutEditorState {
  layout: ProposalLayout
  selection: Selection
  externalVersion: number
}

/** Every mutation the layout editor can make in one dispatch. */
export type LayoutAction =
  | { type: 'select'; sectionId: string | null }
  | { type: 'selectNode'; node: NodeSelection }
  | { type: 'addSection'; at: number; section: Section }
  | { type: 'moveSection'; from: number; to: number }
  | { type: 'duplicateSection'; id: string }
  | { type: 'deleteSection'; id: string }
  | { type: 'updateStyle'; id: string; patch: Partial<SectionStyle> }
  | { type: 'resetStyle'; id: string }
  | { type: 'setContent'; id: string; content: JSONContent }
  /**
   * Replaces a data section's own `data` (Slice E1: FAQ/testimonials/
   * accept/packages inline editing). A no-op when `id` names a content
   * section, or a data section of a *different* kind than `data.kind` -
   * the two must always agree (`sectionDataSchema`'s own
   * `superRefine`), so this guard keeps the reducer from ever writing a
   * layout the schema would then reject.
   */
  | { type: 'setData'; id: string; data: SectionData }
  | { type: 'setName'; id: string; name: string }
  | { type: 'toggleHideOnMobile'; id: string }
  /**
   * Patches the canvas theme (`model/theme.ts`). Shallow at the top level
   * and one level into `animation` / `text.<role>`, so the Page style
   * panel can send `{ animation: { speed: 'fast' } }` or
   * `{ text: { paragraph: { size: 18 } } }` without re-sending the rest.
   * A layout with no theme yet (saved before themes existed) is a no-op:
   * the editor seeds one at load (`withTheme`), so this never happens
   * through the UI.
   */
  | { type: 'setTheme'; patch: ThemePatch }
  | { type: 'replaceLayout'; layout: ProposalLayout }

/** Which section-style field each inheritable theme field is the default for; `setTheme` clears the section field when the theme field changes. */
const SECTION_FIELD_FOR_THEME_KEY: readonly (readonly [keyof ProposalTheme, 'padding' | 'paddingX' | 'contentWidth'])[] = [
  ['sectionPadding', 'padding'],
  ['sectionPaddingX', 'paddingX'],
  ['contentWidth', 'contentWidth'],
]

/** A partial theme for `setTheme`: every level optional, see the action's doc. */
export type ThemePatch = Partial<Omit<ProposalTheme, 'animation' | 'text'>> & {
  animation?: Partial<ProposalTheme['animation']>
  text?: Partial<Record<ThemeTextRole, Partial<ThemeTextStyle>>>
}

/** Merge `patch` into `theme` (see `ThemePatch` for the depth). Pure. */
export function applyThemePatch(theme: ProposalTheme, patch: ThemePatch): ProposalTheme {
  const { animation, text, ...top } = patch
  const nextText = { ...theme.text }
  for (const role of Object.keys(text ?? {}) as ThemeTextRole[]) {
    nextText[role] = { ...theme.text[role], ...text?.[role] }
  }
  return { ...theme, ...top, animation: { ...theme.animation, ...animation }, text: nextText }
}

/** Replace the section at `id` with the result of `updater`, or return `state` unchanged if `id` is not found. */
function updateSection(state: LayoutEditorState, id: string, updater: (section: Section) => Section): LayoutEditorState {
  const idx = state.layout.sections.findIndex((s) => s.id === id)
  if (idx === -1) return state
  const sections = [...state.layout.sections]
  sections[idx] = updater(sections[idx]!)
  return { ...state, layout: { ...state.layout, sections } }
}

// Mirrors `presets.ts`'s `PRESET_BLOCK`: a typed map rather than a `kind as
// BlockType` cast, so a future v2-only `SectionKind` with no v1 counterpart
// is a compile error here instead of a runtime "produced no section" throw.
const DATA_BLOCK: Record<Exclude<SectionKind, 'content' | 'pageBreak'>, BlockType> = {
  packages: 'packages', gallery: 'gallery', video: 'video', testimonials: 'testimonials', faq: 'faq', accept: 'accept',
}

/** One fresh section for `kind`: an empty content section, a bare page break, a data section seeded from its Phase 1 sample data, or a preset. */
export function newSectionFor(kind: SectionKind | { preset: PresetId }, role: ProposalRole = 'mc'): Section {
  if (typeof kind === 'object') return presetSection(kind.preset, role)
  if (kind === 'content') {
    // No `contentWidth`, `padding` or `textColor`: all three inherit from
    // the canvas theme (`model/theme.ts`), so retuning the theme re-flows
    // every untouched Text section.
    return { id: newSectionId(), kind: 'content', style: { height: 'fit' }, content: doc(paragraph()) }
  }
  // A page break has nothing to style; it carries the schema's required
  // `style` at the content default so `resetStyle` and clone paths never
  // meet a section without one.
  if (kind === 'pageBreak') return { id: newSectionId(), kind: 'pageBreak', style: { height: 'fit', contentWidth: 'medium' } }
  // Every data kind's default is the v1 block default, run through the same
  // migration presets.ts already uses, so a fresh section and a migrated
  // one always agree on shape (there is no v2-native default yet).
  const section = migrateProposalTreeToLayout([blockTemplate(DATA_BLOCK[kind])]).sections[0]
  if (!section) throw new Error(`newSectionFor(${kind}) produced no section`)
  return section
}

/**
 * Apply one action to the editor state. Pure: every branch returns a new
 * state (or, when the action is a no-op, the exact same `state` reference
 * so callers can compare with `!==` to skip work).
 */
export function layoutReducer(state: LayoutEditorState, action: LayoutAction): LayoutEditorState {
  switch (action.type) {
    case 'select':
      return { ...state, selection: { sectionId: action.sectionId, node: null } }

    case 'selectNode': {
      const node = action.node
      return { ...state, selection: { sectionId: node ? node.sectionId : state.selection.sectionId, node } }
    }

    case 'addSection': {
      if (state.layout.sections.length >= LAYOUT_LIMITS.maxSections) return state
      const at = Math.max(0, Math.min(action.at, state.layout.sections.length))
      const sections = [...state.layout.sections.slice(0, at), action.section, ...state.layout.sections.slice(at)]
      return { ...state, layout: { ...state.layout, sections }, selection: { sectionId: action.section.id, node: null } }
    }

    case 'moveSection': {
      const len = state.layout.sections.length
      if (action.from < 0 || action.from >= len) return state
      const to = Math.max(0, Math.min(action.to, len - 1))
      if (to === action.from) return state
      const sections = [...state.layout.sections]
      const [moved] = sections.splice(action.from, 1)
      sections.splice(to, 0, moved!)
      return { ...state, layout: { ...state.layout, sections } }
    }

    case 'duplicateSection': {
      const idx = state.layout.sections.findIndex((s) => s.id === action.id)
      if (idx === -1) return state
      const copy: Section = { ...state.layout.sections[idx]!, id: newSectionId() }
      const sections = [...state.layout.sections.slice(0, idx + 1), copy, ...state.layout.sections.slice(idx + 1)]
      // Controller decision: the copy becomes the selection, matching `addSection`.
      return { ...state, layout: { ...state.layout, sections }, selection: { sectionId: copy.id, node: null } }
    }

    case 'deleteSection': {
      if (!state.layout.sections.some((s) => s.id === action.id)) return state
      const sections = state.layout.sections.filter((s) => s.id !== action.id)
      // A selection pointing at the deleted section (as the section itself
      // or as the owner of a selected node) no longer resolves to anything.
      const sectionId = state.selection.sectionId === action.id ? null : state.selection.sectionId
      const node = state.selection.node?.sectionId === action.id ? null : state.selection.node
      return { ...state, layout: { ...state.layout, sections }, selection: { sectionId, node } }
    }

    case 'updateStyle': {
      // A value equal to the page default is stored as "inherit"
      // (`inheritMatchingDefaults`): picking Cozy while the page is Cozy
      // means "like the page", and the section keeps following Global
      // style afterwards. A layout with no theme yet (a reducer test's bare
      // state) has no default to match and stores the patch as given.
      const theme = state.layout.theme
      return updateSection(state, action.id, (s) => {
        const style = { ...s.style, ...action.patch }
        return { ...s, style: theme ? inheritMatchingDefaults(style, theme) : style }
      })
    }

    // Presets are not tracked on a section once inserted, so "reset" means
    // the plain kind default, not the preset's own starting style: a
    // restyled Hero resets to a bare content section's style, not Hero's.
    case 'resetStyle':
      return updateSection(state, action.id, (s) => ({ ...s, style: newSectionFor(s.kind).style }))

    case 'setContent': {
      const target = state.layout.sections.find((s) => s.id === action.id)
      if (!target || target.kind !== 'content') return state
      // Normalised here (not left to the caller) so every path into the
      // reducer is safe even if a future caller forgets to normalise first.
      return updateSection(state, action.id, (s) => ({ ...s, content: toPlainJSON(action.content) }))
    }

    case 'setData': {
      const target = state.layout.sections.find((s) => s.id === action.id)
      if (!target || target.kind !== action.data.kind) return state
      // Normalised here for the same reason `setContent` is: every path
      // into the reducer must be safe even if a future caller (an
      // `edit-*.tsx` slot builder today, something else later) forgets to
      // normalise the TipTap JSON nested inside `data` before dispatching.
      return updateSection(state, action.id, (s) => ({ ...s, data: toPlainJSON(action.data) }))
    }

    case 'setName':
      return updateSection(state, action.id, (s) => ({ ...s, name: action.name }))

    case 'setTheme': {
      if (!state.layout.theme) return state
      const theme = applyThemePatch(state.layout.theme, action.patch)
      // A page-level width or padding change is "set this for every
      // section": each section's own value for that field is cleared so
      // the new page value reaches it (2026-09-19: "preview is respecting
      // horizontal padding but not vertical" - the hero carried a 38px
      // padding from an earlier drag the author had no way to see, so the
      // Global control appeared dead). A section that should differ gets
      // its own value set again afterwards, in its Style; the previous
      // overrides come back with Cmd+Z, since this is one history step.
      const cleared = SECTION_FIELD_FOR_THEME_KEY.filter(([themeKey]) => themeKey in action.patch).map(([, field]) => field)
      const sections = cleared.length === 0
        ? state.layout.sections
        : state.layout.sections.map((s) => {
            if (!cleared.some((field) => s.style[field] !== undefined)) return s
            const style = { ...s.style }
            for (const field of cleared) delete style[field]
            return { ...s, style }
          })
      return { ...state, layout: { ...state.layout, theme, sections } }
    }

    case 'toggleHideOnMobile':
      return updateSection(state, action.id, (s) => ({ ...s, hideOnMobile: !s.hideOnMobile }))

    case 'replaceLayout':
      return { ...state, layout: action.layout, selection: { sectionId: null, node: null } }

    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
