/**
 * The single list of "insert a thing at the cursor" commands shared by
 * the `/` slash menu (`extensions/slash-menu.ts`) and the text section's
 * `+` insert button (Task 9's bar): one source of truth for what a
 * content section can hold, in one display order, so the two entry
 * points can never drift apart.
 *
 * Most items drive an editor command directly (a heading toggle, a plain
 * node insert). Image, audio, embed and variable have no self-contained
 * insert: they need a picker, an upload flow, or a URL prompt, which this
 * list has no UI to show. Those four only invoke the matching callback on
 * `editor.storage.proposalEditor.callbacks`
 * (`extensions/proposal-editor-storage.ts`) and do nothing if it is
 * unset. `image`/`audio`/`embed` are registered by `use-insert-media.ts`
 * (mounted once in `template-editor-body.tsx`); `variable` by
 * `bars/text-bar-insert.tsx`. Embed in particular never inserts a bare
 * `url: null` placeholder here - `extensions/embed.ts`'s `setEmbed`
 * command refuses any url `detectEmbedProvider` doesn't recognise, and an
 * empty embed node fails `parseProposalLayout` on every autosave (see the
 * final review's Finding 2), so `insert-media-host.tsx`'s
 * `EmbedInsertModal` prompts for a valid url *before* the node exists.
 *
 * @module features/proposals/editor/insert-items
 */
import type { Editor } from '@tiptap/core'
import {
  AtSign, Columns2, Columns3, Heading1, Heading2, Heading3, ImageIcon, LayoutTemplate, LinkIcon, Minus,
  MoveVertical, Music, Table as TableIcon, type LucideIcon,
} from 'lucide-react'

/** One row the slash menu and the text bar's `+` both render; both run it through `run`. */
export interface InsertItem {
  /** Stable id, also the slash-menu list's React key and the target of the `divider`/`table`/… unit tests. */
  id: string
  label: string
  icon: LucideIcon
  /** Applies this item to `editor`. Never throws: an unregistered picker callback (image/audio/variable) is a silent no-op, not an error. */
  run: (editor: Editor) => void
}

/** Reads the callback registered by a bar or `use-insert-media.ts` for a picker-backed item, or `undefined` before one is registered. */
function callback(editor: Editor, name: 'requestImage' | 'requestAudio' | 'requestEmbed' | 'requestVariable'): (() => void) | undefined {
  return editor.storage.proposalEditor?.callbacks?.[name]
}

/** Every insertable block, in the order the slash menu and the `+` menu show it. */
export const INSERT_ITEMS: readonly InsertItem[] = [
  { id: 'heading1', label: 'Heading 1', icon: Heading1, run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'heading2', label: 'Heading 2', icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'heading3', label: 'Heading 3', icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'image', label: 'Image', icon: ImageIcon, run: (e) => callback(e, 'requestImage')?.() },
  { id: 'button', label: 'Button', icon: LinkIcon, run: (e) => e.chain().focus().insertContent({ type: 'button' }).run() },
  { id: 'columns2', label: '2 columns', icon: Columns2, run: (e) => e.chain().focus().insertColumns(2).run() },
  { id: 'columns3', label: '3 columns', icon: Columns3, run: (e) => e.chain().focus().insertColumns(3).run() },
  { id: 'embed', label: 'Embed', icon: LayoutTemplate, run: (e) => callback(e, 'requestEmbed')?.() },
  { id: 'audio', label: 'Audio', icon: Music, run: (e) => callback(e, 'requestAudio')?.() },
  { id: 'divider', label: 'Divider', icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
  { id: 'spacer', label: 'Spacer', icon: MoveVertical, run: (e) => e.chain().focus().insertContent({ type: 'spacer' }).run() },
  { id: 'table', label: 'Table', icon: TableIcon, run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3 }).run() },
  { id: 'variable', label: 'Variable', icon: AtSign, run: (e) => callback(e, 'requestVariable')?.() },
] as const

/** `INSERT_ITEMS` whose label matches `query` (case-insensitive substring); the empty query matches everything. Shared by the slash menu's `items` option and, later, the `+` menu's own search box. */
export function filterInsertItems(query: string): InsertItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...INSERT_ITEMS]
  return INSERT_ITEMS.filter((item) => item.label.toLowerCase().includes(q))
}
