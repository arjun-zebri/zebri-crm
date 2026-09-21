'use client'

// Client boundary on purpose: the node extensions below value-import
// `ReactNodeViewRenderer` from `@tiptap/react`, which extends a React
// class at module evaluation. The `[id]` template route is a server
// component that imports the `@/features/proposals` barrel, and without
// this directive the barrel pulled this file (and so `@tiptap/react`) into
// the RSC module graph and the page 500'd ("Class extends value
// undefined"). Nothing on the server calls anything exported here.
/**
 * The v2 editor's full TipTap extension set (spec §2.2): StarterKit's prose
 * basics plus every block node and mark `rich-doc-spec.ts` lists. One
 * function builds a fresh set per editor instance (so `Placeholder`'s text
 * can vary per rich-text field, and a future node-view flag can be toggled
 * without a shared singleton leaking state between editors); the name
 * arrays below are derived from that same build, so a node or mark added
 * here without a matching spec entry (or vice versa) fails the parity test
 * instead of drifting silently.
 *
 * @module features/proposals/editor/extensions
 */
import { getSchema, type AnyExtension } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { Placeholder, type PlaceholderOptions } from '@tiptap/extension-placeholder'
import { Color, FontFamily, TextStyle } from '@tiptap/extension-text-style'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { FluidFontSizeExtension } from '@/lib/branding/fluid-font-size'
import { Variable as VariableBase } from '@/lib/branding/rich-text-extensions'

import { VariableView } from '../node-views/variable-view'

import { AudioExtension } from './audio'
import { ButtonExtension } from './button'
import { ColumnExtension, ColumnsExtension } from './columns'
import { EmbedExtension } from './embed'
import { FontWeightExtension } from './font-weight'
import { HistoryKeymapExtension } from './history-keymap'
import { ImageExtension } from './image'
import { LetterSpacingExtension } from './letter-spacing'
import { LineHeightExtension } from './line-height'
import { LinkClickExtension } from './link-click'
import { ProposalEditorStorageExtension } from './proposal-editor-storage'
import { SlashMenuExtension } from './slash-menu'
import { SpacerExtension } from './spacer'
import { TABLE_EXTENSIONS } from './table'
import { TextAlignExtension } from './text-align'
import { TextCaseExtension } from './text-case'
import { TopSpacingExtension } from './top-spacing'
import { TrailingParagraphExtension } from './trailing-paragraph'
import { VariableSuggestionExtension } from './variable-suggestion'

// The shared `Variable` node (`lib/branding/rich-text-extensions.ts`) has no
// node view of its own - the branding rich-text editor layers its own mint
// chip on top the same way (`rich-text.tsx`'s `Variable.extend(...)`). This
// is the proposal editor's equivalent, gated by the same `nodeViews` option
// every other node view here uses (see `RichDocExtensionOptions`), so a
// schema-only build (the parity test, `getSchema`) never needs React.
const Variable = VariableBase.extend<{ nodeViews: boolean }>({
  addOptions() {
    return { nodeViews: false }
  },
  addNodeView() {
    return this.options.nodeViews ? ReactNodeViewRenderer(VariableView) : null
  },
})

/**
 * The `Placeholder` options for the rich doc. TipTap's defaults
 * (`showOnlyCurrent`, no `includeChildren`) never walk into a `columns`
 * row, so a freshly inserted 2/3-up read as a blank gap with no hint at
 * all. Walking children and deciding per block instead: an empty column
 * (a `column` whose only block is empty) always carries the hint, caret
 * or not, so every cell says what `/` does the moment the row lands;
 * elsewhere (a top-level line, a line inside a filled column) the hint
 * still follows the caret only. Blocks nested anywhere else (a list item,
 * a blockquote, a table cell) get no hint, exactly as before.
 */
function placeholderOptions(hint: string): Partial<PlaceholderOptions> {
  return {
    includeChildren: true,
    showOnlyCurrent: false,
    placeholder: ({ editor, pos, hasAnchor }) => {
      // `editor.state` is the state the decoration pass is running
      // against: ProseMirror assigns `view.state` before it redraws.
      const parent = editor.state.doc.resolve(pos).parent
      const inColumn = parent.type.name === 'column'
      if (inColumn && parent.childCount === 1) return hint
      if ((inColumn || parent.type.name === 'doc') && hasAnchor) return hint
      return ''
    },
  }
}

export { normaliseEditorJSON } from './normalise'
export { SLASH_MENU_PLUGIN_KEY, SlashMenuExtension } from './slash-menu'
export {
  filterProposalVariables, InlineFieldSlashVariableExtension, VARIABLE_AT_PLUGIN_KEY, VARIABLE_BRACES_PLUGIN_KEY, VARIABLE_SLASH_PLUGIN_KEY, VariableSuggestionExtension,
} from './variable-suggestion'

/** Options `buildRichDocExtensions` accepts. */
export interface RichDocExtensionOptions {
  /** Placeholder text shown in an empty document. */
  placeholder?: string
  /** Swaps the plain DOM node rendering for React NodeViews (Task 7) on every node that has one (image, button, embed, audio, columns, spacer), so the canvas is WYSIWYG and atoms get resize grips. Off by default so schema-only uses (the parity test, `getSchema`) don't need React. */
  nodeViews?: boolean
}

/**
 * Every extension the v2 rich doc needs, in one place, so the editor, the
 * schema and the renderer agree. `undoRedo: false` (StarterKit's history
 * option, renamed in TipTap 3) because document edits are undone by the
 * layout editor's own history (Task 3), not TipTap's: two undo stacks
 * fighting over the same keystroke is worse than one. `HistoryKeymapExtension`
 * (Task 15) is what makes Meta+Z reach that history at all while an editor
 * has focus, since disabling TipTap's own history also removes its keymap.
 */
export function buildRichDocExtensions(o: RichDocExtensionOptions): AnyExtension[] {
  const nodeViews = o.nodeViews ?? false
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      undoRedo: false,
      codeBlock: false,
      code: false,
      // `openOnClick: false`: TipTap's own click-to-open fires on any plain
      // click, which fights editing - a click meant to place the caret
      // inside link text instead navigated away from the document. A
      // Cmd/Ctrl click still opens it, via `LinkClickExtension` below. The
      // `underline` class matches the public render (`render/rich-doc.tsx`'s
      // link mark) so a link reads as one on the canvas exactly as it will
      // for the couple.
      link: { openOnClick: false, autolink: true, protocols: ['https', 'mailto', 'tel'], HTMLAttributes: { class: 'underline' } },
    }),
    TextStyle,
    Color,
    FontFamily,
    FluidFontSizeExtension,
    FontWeightExtension,
    LetterSpacingExtension,
    LineHeightExtension,
    TopSpacingExtension,
    Highlight.configure({ multicolor: true }),
    TextAlignExtension.configure({ types: ['heading', 'paragraph'] }),
    ...TABLE_EXTENSIONS,
    TrailingParagraphExtension,
    Placeholder.configure(placeholderOptions(o.placeholder ?? '')),
    Variable.configure({ nodeViews }),
    ProposalEditorStorageExtension,
    HistoryKeymapExtension,
    ImageExtension.configure({ nodeViews }),
    ButtonExtension.configure({ nodeViews }),
    EmbedExtension.configure({ nodeViews }),
    AudioExtension.configure({ nodeViews }),
    ColumnsExtension.configure({ nodeViews }),
    ColumnExtension,
    SpacerExtension.configure({ nodeViews }),
    TextCaseExtension,
    // The `/` slash menu (Task 8): a plain ProseMirror-plugin extension,
    // no node/mark, so it is safe to include unconditionally without
    // touching `EDITOR_NODE_NAMES`/`EDITOR_MARK_NAMES` below.
    SlashMenuExtension,
    // The `@` / `{{` variable trigger: the same kind of plugin-only extension.
    VariableSuggestionExtension,
    // Cmd/Ctrl-gates the Link mark's click-to-open (`openOnClick: false`
    // above); a plugin-only extension like the two above it.
    LinkClickExtension,
  ]
}

// The parity test (tests/unit/features/proposals/editor/extensions.test.ts)
// asserts these against `rich-doc-spec.ts`'s `NODE_TYPES`/`MARK_TYPES`
// directly; deriving them from a real built schema (rather than typing them
// out by hand) means the assertion can only pass when the extensions above
// truly register those names.
const NAME_SCHEMA = getSchema(buildRichDocExtensions({}))

/** Names of every node `buildRichDocExtensions` registers (for the parity test and the slash menu), excluding the `doc` root. */
export const EDITOR_NODE_NAMES: readonly string[] = Object.keys(NAME_SCHEMA.nodes).filter((name) => name !== 'doc')
/** Names of every mark `buildRichDocExtensions` registers (for the parity test and the format toolbar). */
export const EDITOR_MARK_NAMES: readonly string[] = Object.keys(NAME_SCHEMA.marks)
