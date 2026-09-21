/**
 * The single list of "insert a thing at the cursor" commands the `/`
 * slash menu (`extensions/slash-menu.ts`) runs: one source of truth for
 * what a content section can hold, in one display order, grouped the way
 * the menu shows them (Text, Content, Media, Interactive, Variables).
 * The text bar's `+` button that once shared this list is gone: the
 * founder found it odd beside the `/` menu doing the same job, so `/` is
 * the one way to insert inline content.
 *
 * Most items drive an editor command directly (a heading toggle, a plain
 * node insert). Image, audio and embed have no self-contained insert:
 * they need a picker, an upload flow, or a URL prompt, which this list
 * has no UI to show. Those three only invoke the matching callback on
 * `editor.storage.proposalEditor.callbacks`
 * (`extensions/proposal-editor-storage.ts`) and do nothing if it is
 * unset; `use-insert-media.ts` (mounted once in `template-editor-body.tsx`)
 * registers them. Embed in particular never inserts a bare `url: null`
 * placeholder here - `extensions/embed.ts`'s `setEmbed` command refuses
 * any url `detectEmbedProvider` doesn't recognise, and an empty embed
 * node fails `parseProposalLayout` on every autosave (see the final
 * review's Finding 2), so `insert-media-host.tsx`'s `EmbedInsertModal`
 * prompts for a valid url *before* the node exists.
 *
 * Variables are one row each (`var:<id>`) rather than a "Variable" row
 * opening a second picker: with the `+` button gone there is no popover
 * to host that picker, and a flat row per variable is what `/` users
 * expect anyway (the `@` / `{{` triggers in `variable-suggestion.ts`
 * remain the quicker route once you know the name).
 *
 * @module features/proposals/editor/insert-items
 */
import type { Editor } from '@tiptap/core'
import {
  AtSign, Columns2, Columns3, Heading1, Heading2, Heading3, ImageIcon, LayoutTemplate, LinkIcon, Minus,
  MoveVertical, Music, Table as TableIcon, type LucideIcon,
} from 'lucide-react'

import { PROPOSAL_VARIABLES } from '../model/variables'

/** The slash menu's section headings, in display order. */
export type InsertGroup = 'Text' | 'Content' | 'Media' | 'Interactive' | 'Variables'

/** One row the slash menu renders and runs through `run`. */
export interface InsertItem {
  /** Stable id, also the slash-menu list's React key and the target of the `divider`/`table`/… unit tests. */
  id: string
  label: string
  icon: LucideIcon
  /** Which heading the row sits under in the `/` menu. Unset for the `@` / `{{` variable trigger's rows, which show no headings. */
  group?: InsertGroup
  /** Applies this item to `editor`. Never throws: an unregistered picker callback (image/audio/embed) is a silent no-op, not an error. */
  run: (editor: Editor) => void
}

/** Reads the callback registered by `use-insert-media.ts` for a picker-backed item, or `undefined` before one is registered. */
function callback(editor: Editor, name: 'requestImage' | 'requestAudio' | 'requestEmbed'): (() => void) | undefined {
  return editor.storage.proposalEditor?.callbacks?.[name]
}

/** Every insertable block, in the order the slash menu shows it. */
export const INSERT_ITEMS: readonly InsertItem[] = [
  { id: 'heading1', label: 'Heading 1', icon: Heading1, group: 'Text', run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'heading2', label: 'Heading 2', icon: Heading2, group: 'Text', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'heading3', label: 'Heading 3', icon: Heading3, group: 'Text', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'image', label: 'Image', icon: ImageIcon, group: 'Content', run: (e) => callback(e, 'requestImage')?.() },
  { id: 'columns2', label: '2 columns', icon: Columns2, group: 'Content', run: (e) => e.chain().focus().insertColumns(2).run() },
  { id: 'columns3', label: '3 columns', icon: Columns3, group: 'Content', run: (e) => e.chain().focus().insertColumns(3).run() },
  { id: 'table', label: 'Table', icon: TableIcon, group: 'Content', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3 }).run() },
  { id: 'divider', label: 'Divider', icon: Minus, group: 'Content', run: (e) => e.chain().focus().setHorizontalRule().run() },
  { id: 'spacer', label: 'Spacer', icon: MoveVertical, group: 'Content', run: (e) => e.chain().focus().insertContent({ type: 'spacer' }).run() },
  { id: 'embed', label: 'Embed', icon: LayoutTemplate, group: 'Media', run: (e) => callback(e, 'requestEmbed')?.() },
  { id: 'audio', label: 'Audio', icon: Music, group: 'Media', run: (e) => callback(e, 'requestAudio')?.() },
  { id: 'button', label: 'Button', icon: LinkIcon, group: 'Interactive', run: (e) => e.chain().focus().insertContent({ type: 'button' }).run() },
  ...PROPOSAL_VARIABLES.map((v): InsertItem => ({
    id: `var:${v.id}`,
    label: v.label,
    icon: AtSign,
    group: 'Variables',
    run: (e) => e.chain().focus().insertContent({ type: 'variable', attrs: { id: v.id } }).run(),
  })),
]

/** `INSERT_ITEMS` whose label matches `query` (case-insensitive substring); the empty query matches everything. The slash menu's `items` option. */
export function filterInsertItems(query: string): InsertItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...INSERT_ITEMS]
  return INSERT_ITEMS.filter((item) => item.label.toLowerCase().includes(q))
}
