// tests/unit/features/proposals/editor/variable-suggestion.test.ts
/**
 * The `@` / `{{` variable trigger: `filterProposalVariables` (the query
 * filter the suggestion plugin's `items` option calls) and the plugin
 * itself opening in a content section's editor and in a data section's
 * `InlineField` extension set, since "variables anywhere" means the one
 * mechanism has to work in both.
 */
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import {
  buildRichDocExtensions, doc, filterProposalVariables, InlineFieldSlashVariableExtension, paragraph, text,
  VARIABLE_AT_PLUGIN_KEY, VARIABLE_BRACES_PLUGIN_KEY, VARIABLE_SLASH_PLUGIN_KEY, VariableSuggestionExtension,
} from '@/features/proposals'
import { RICH_TEXT_EXTENSIONS } from '@/lib/branding/rich-text-extensions'

describe('filterProposalVariables', () => {
  it('returns every proposal variable for an empty query', () => {
    expect(filterProposalVariables('').map((v) => v.id)).toContain('couple_name')
    expect(filterProposalVariables('')).toHaveLength(11)
  })

  it('matches on label or id, case-insensitively', () => {
    expect(filterProposalVariables('coup').map((v) => v.id)).toEqual(['couple_name'])
    expect(filterProposalVariables('EVENT').map((v) => v.id)).toEqual(['event_date'])
  })
})

describe('the @ variable trigger', () => {
  it('opens after @ at a word start and tracks the query', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph(text('Hi '))) })
    editor.commands.focus('end')
    editor.commands.insertContent('@cou')
    expect(VARIABLE_AT_PLUGIN_KEY.getState(editor.state)?.active).toBe(true)
    expect(VARIABLE_AT_PLUGIN_KEY.getState(editor.state)?.query).toBe('cou')
    editor.destroy()
  })

  it('does not open for a mid-word @ (an email address)', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    editor.commands.insertContent('sam@zebri')
    expect(VARIABLE_AT_PLUGIN_KEY.getState(editor.state)?.active).toBe(false)
    editor.destroy()
  })

  it('opens after {{ too, in a bare extension set like InlineField uses', () => {
    const editor = new Editor({ extensions: [...RICH_TEXT_EXTENSIONS, VariableSuggestionExtension], content: doc(paragraph()) })
    editor.commands.insertContent('{{ven')
    expect(VARIABLE_BRACES_PLUGIN_KEY.getState(editor.state)?.active).toBe(true)
    expect(VARIABLE_BRACES_PLUGIN_KEY.getState(editor.state)?.query).toBe('ven')
    editor.destroy()
  })

  it('picking a variable replaces the trigger text with the chip', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph(text('Hi '))) })
    editor.commands.focus('end')
    editor.commands.insertContent('@cou')
    const state = VARIABLE_AT_PLUGIN_KEY.getState(editor.state) as { range: { from: number; to: number } }
    editor.chain().focus().deleteRange(state.range).insertContent({ type: 'variable', attrs: { id: 'couple_name' } }).run()
    expect(editor.getJSON()).toMatchObject(doc(paragraph(text('Hi '), { type: 'variable', attrs: { id: 'couple_name' } })))
    editor.destroy()
  })
})

describe('the / variable trigger (InlineField only)', () => {
  it('opens after / at a word start and tracks the query, in a bare extension set like InlineField uses', () => {
    const editor = new Editor({ extensions: [...RICH_TEXT_EXTENSIONS, InlineFieldSlashVariableExtension], content: doc(paragraph(text('Hi '))) })
    editor.commands.focus('end')
    editor.commands.insertContent('/ven')
    expect(VARIABLE_SLASH_PLUGIN_KEY.getState(editor.state)?.active).toBe(true)
    expect(VARIABLE_SLASH_PLUGIN_KEY.getState(editor.state)?.query).toBe('ven')
    editor.destroy()
  })

  it('is not registered in the main content editor, whose own / is the block-insertion slash menu', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    editor.commands.insertContent('/ven')
    expect(VARIABLE_SLASH_PLUGIN_KEY.getState(editor.state)).toBeUndefined()
    editor.destroy()
  })
})
