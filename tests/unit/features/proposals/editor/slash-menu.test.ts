// tests/unit/features/proposals/editor/slash-menu.test.ts
/**
 * Task 8: the `/` slash menu. `filterInsertItems` (the query filter the
 * suggestion plugin's `items` option calls, shared with the text bar's
 * `+`) and the ProseMirror suggestion plugin itself opening at the start
 * of an empty paragraph and tracking the typed query.
 */
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, doc, filterInsertItems, paragraph, SLASH_MENU_PLUGIN_KEY } from '@/features/proposals'

describe('filterInsertItems', () => {
  it('returns every item for an empty query', () => {
    expect(filterInsertItems('')).toHaveLength(13)
  })

  it('filters to items whose label matches the query, e.g. "div" -> Divider only', () => {
    expect(filterInsertItems('div').map((i) => i.id)).toEqual(['divider'])
  })

  it('is case-insensitive', () => {
    expect(filterInsertItems('DIV').map((i) => i.id)).toEqual(['divider'])
  })

  it('returns nothing for a query no label matches', () => {
    expect(filterInsertItems('zzz')).toEqual([])
  })
})

/** The suggestion plugin's current `{ active, query }` state, or `undefined` before it has ever run. */
function suggestionState(editor: Editor): { active: boolean; query: string | null } | undefined {
  return SLASH_MENU_PLUGIN_KEY.getState(editor.state)
}

describe('the / slash menu', () => {
  it('opens at the start of an empty paragraph', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    editor.commands.insertContent('/')
    expect(suggestionState(editor)?.active).toBe(true)
    expect(suggestionState(editor)?.query).toBe('')
    editor.destroy()
  })

  it('tracks the typed query after the trigger', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    editor.commands.insertContent('/div')
    expect(suggestionState(editor)?.active).toBe(true)
    expect(suggestionState(editor)?.query).toBe('div')
    editor.destroy()
  })

  it('does not open mid-word (no leading space or line start)', () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    editor.commands.insertContent('a/b')
    expect(suggestionState(editor)?.active).toBe(false)
    editor.destroy()
  })
})
