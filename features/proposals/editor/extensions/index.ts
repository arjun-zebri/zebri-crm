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
import { Placeholder } from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

import { Variable } from '@/lib/branding/rich-text-extensions'

import { AudioExtension } from './audio'
import { ButtonExtension } from './button'
import { ColumnExtension, ColumnsExtension } from './columns'
import { EmbedExtension } from './embed'
import { HistoryKeymapExtension } from './history-keymap'
import { ImageExtension } from './image'
import { ProposalEditorStorageExtension } from './proposal-editor-storage'
import { SlashMenuExtension } from './slash-menu'
import { SpacerExtension } from './spacer'
import { TextCaseExtension } from './text-case'

export { normaliseEditorJSON } from './normalise'
export { SLASH_MENU_PLUGIN_KEY, SlashMenuExtension } from './slash-menu'

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
      link: { openOnClick: false, autolink: true, protocols: ['https', 'mailto', 'tel'] },
    }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder: o.placeholder ?? '' }),
    Variable,
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
