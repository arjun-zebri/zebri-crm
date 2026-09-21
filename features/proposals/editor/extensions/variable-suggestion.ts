'use client'

/**
 * The `@` / `{{` variable trigger: typing either at a word start opens the
 * proposal's variables (`PROPOSAL_VARIABLES`) filtered by what follows;
 * Enter or a click swaps the typed trigger for a `variable` chip. One
 * mechanism for "variables anywhere": registered in
 * `buildRichDocExtensions` for content sections and in `InlineField` for
 * every data-section text field, neither of which needs the text bar's
 * `+` menu (which data-section fields do not have) for it to work.
 *
 * Two plugins, one per trigger, each with its own key: `@` for anyone
 * who knows the email composer's mention habit, `{{` for anyone who has
 * seen a resolved template. Mid-word `@` (an email address) never opens,
 * the same leading-space/line-start rule `components/ui/variable-suggestion.tsx`
 * relies on. The floating list is the `/` menu's own (`suggestion-float.ts`).
 *
 * `InlineFieldSlashVariableExtension` below adds a third trigger, `/`,
 * for `InlineField` only (2026-09-19 feedback: "the / commands ... should
 * work" in a data-section field) - kept as its own extension rather than
 * a third plugin here, because this extension is also registered in the
 * main content editor, where `/` is already `SlashMenuExtension`'s
 * block-insertion menu; a second `Suggestion` plugin on the same trigger
 * character in that editor would fire alongside it. A data-section field
 * has no block-insertion menu to collide with (no image/button/table/etc.
 * node is even mounted there - see `InlineField`'s own doc), so `/`
 * reopening the same variable list `@` does is the correct, schema-legal
 * substitute, not a smaller version of the main menu.
 *
 * @module features/proposals/editor/extensions/variable-suggestion
 */
import { Extension, type Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Suggestion } from '@tiptap/suggestion'
import { AtSign } from 'lucide-react'

import type { DocumentVariable } from '@/lib/branding/document-variables'

import { PROPOSAL_VARIABLES } from '../../model/variables'
import type { InsertItem } from '../insert-items'

import { floatingListRenderer } from './suggestion-float'

/** Live `{ active, query, range }` state of the `@` trigger, via `VARIABLE_AT_PLUGIN_KEY.getState(editor.state)`. */
export const VARIABLE_AT_PLUGIN_KEY = new PluginKey('proposal-variable-at')
/** Live state of the `{{` trigger. */
export const VARIABLE_BRACES_PLUGIN_KEY = new PluginKey('proposal-variable-braces')
/** Live state of the `/` trigger - `InlineField` only, see the module doc. */
export const VARIABLE_SLASH_PLUGIN_KEY = new PluginKey('proposal-variable-slash')

/** The proposal variables whose label or id contains `query` (case-insensitive); every one for an empty query. */
export function filterProposalVariables(query: string): readonly DocumentVariable[] {
  const q = query.trim().toLowerCase()
  if (!q) return PROPOSAL_VARIABLES
  return PROPOSAL_VARIABLES.filter((v) => v.label.toLowerCase().includes(q) || v.id.includes(q))
}

/** A variable as a list row: the shared `SlashMenuList` renders `InsertItem`s, so each variable becomes one whose `run` inserts its chip. */
function toItem(v: DocumentVariable): InsertItem {
  return {
    id: v.id,
    label: v.label,
    icon: AtSign,
    run: (editor) => { editor.chain().focus().insertContent({ type: 'variable', attrs: { id: v.id } }).run() },
  }
}

function plugin(editor: Editor, char: string, pluginKey: PluginKey) {
  return Suggestion<InsertItem, InsertItem>({
    editor,
    char,
    pluginKey,
    items: ({ query }) => filterProposalVariables(query).map(toItem),
    command: ({ editor: ed, range, props }: { editor: Editor; range: { from: number; to: number }; props: InsertItem }) => {
      // The trigger text goes first, so the chip lands in its place.
      ed.chain().focus().deleteRange(range).run()
      props.run(ed)
    },
    render: floatingListRenderer('No matching variables'),
  })
}

/** The TipTap extension registering the `@` and `{{` variable triggers. A plain `Extension`, no node/mark: safe in any schema that has the `variable` node. */
export const VariableSuggestionExtension = Extension.create({
  name: 'variableSuggestion',

  addProseMirrorPlugins() {
    return [plugin(this.editor, '@', VARIABLE_AT_PLUGIN_KEY), plugin(this.editor, '{{', VARIABLE_BRACES_PLUGIN_KEY)]
  },
})

/** The `/` variable trigger for `InlineField` only - see the module doc for why this is a separate extension rather than a third plugin above. */
export const InlineFieldSlashVariableExtension = Extension.create({
  name: 'inlineFieldSlashVariable',

  addProseMirrorPlugins() {
    return [plugin(this.editor, '/', VARIABLE_SLASH_PLUGIN_KEY)]
  },
})
