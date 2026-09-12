/**
 * Numbering formats on contract lists.
 *
 * The format is an attribute on the ordered-list node that travels as
 * `data-list-style` into the locked HTML, where CSS turns it into the
 * marker. Two things can silently lose it on the way: `generateHTML`
 * drops attributes no registered extension declares, and the sanitiser
 * strips attributes not on its allowlist. Both are pinned here.
 */
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { buildContractVariables, renderContractHtml } from '@/lib/contracts/contract-variables'
import {
  CONTRACT_LIST_STYLES,
  ContractListItem,
  ContractListStyles,
  effectiveListStyle,
  isContractListStyle,
} from '@/lib/contracts/list-styles'

const vars = buildContractVariables({
  couple: { name: 'Sam and Alex', email: null },
  firstEvent: null,
  userMeta: {},
})

function listDoc(listStyle: unknown) {
  return {
    type: 'doc',
    content: [
      {
        type: 'orderedList',
        attrs: { listStyle },
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deposit' }] }],
          },
        ],
      },
    ],
  }
}

describe('contract list numbering formats', () => {
  it('offers the eight legal-style formats', () => {
    expect(CONTRACT_LIST_STYLES.map((s) => s.id)).toEqual([
      'decimal',
      'decimal-outline',
      'lower-alpha',
      'lower-alpha-paren',
      'upper-alpha',
      'lower-roman',
      'lower-roman-paren',
      'upper-roman',
    ])
  })

  it('recognises only catalogued ids', () => {
    expect(isContractListStyle('lower-roman-paren')).toBe(true)
    expect(isContractListStyle('bullet')).toBe(false)
    expect(isContractListStyle(null)).toBe(false)
  })

  it('keeps a chosen format on the rendered list', () => {
    const html = renderContractHtml(listDoc('lower-alpha-paren'), vars)
    expect(html).toContain('<ol data-list-style="lower-alpha-paren">')
    expect(html).toContain('<li><p>Deposit</p></li>')
  })

  it('drops a format that is not in the catalogue', () => {
    // The stored JSON is user-writable, so the catalogue is the allowlist.
    const html = renderContractHtml(listDoc('evil"><script>'), vars)
    expect(html).not.toContain('data-list-style')
    expect(html).toContain('<ol><li><p>Deposit</p></li></ol>')
  })

  it('renders an unstyled list exactly as before', () => {
    const html = renderContractHtml(listDoc(null), vars)
    expect(html).toBe('<ol><li><p>Deposit</p></li></ol>')
  })
})

/** Outer list "Fees" holding a nested list "Card", both unstyled. */
const nestedDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Fees' }] },
            {
              type: 'orderedList',
              content: [
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Card' }] }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

const editors: Editor[] = []

/** The document as plain `JSONContent` (v3 types `getJSON()` as a node union). */
function json(editor: Editor): JSONContent {
  return editor.getJSON() as JSONContent
}

/** A headless editor with the caret placed inside the text `word`. */
function editorAt(content: JSONContent, word: string) {
  const editor = new Editor({ extensions: [StarterKit, ContractListStyles], content })
  editors.push(editor)
  let pos = 0
  editor.state.doc.descendants((node, nodePos) => {
    if (node.isText && node.text === word) pos = nodePos + 1
  })
  editor.commands.setTextSelection(pos)
  return editor
}

describe('setListStyle command', () => {
  // A live view schedules a scroll-to-selection on a timer; in jsdom that
  // lands on `getClientRects`, which text nodes lack, after the test is over.
  afterEach(() => {
    editors.splice(0).forEach((e) => e.destroy())
  })

  it('styles only the list nearest the caret, not its ancestors', () => {
    const editor = editorAt(nestedDoc, 'Card')
    editor.commands.setListStyle('lower-alpha-paren')

    const outer = json(editor).content?.[0]
    const inner = outer?.content?.[0]?.content?.[1]
    expect(inner?.attrs?.listStyle).toBe('lower-alpha-paren')
    expect(outer?.attrs?.listStyle ?? null).toBeNull()
  })

  it('restyles the outer list when the caret is in it', () => {
    const editor = editorAt(nestedDoc, 'Fees')
    editor.commands.setListStyle('upper-alpha')

    const outer = json(editor).content?.[0]
    const inner = outer?.content?.[0]?.content?.[1]
    expect(outer?.attrs?.listStyle).toBe('upper-alpha')
    expect(inner?.attrs?.listStyle ?? null).toBeNull()
  })

  it('stores the default format as no attribute', () => {
    const editor = editorAt(listDoc('lower-roman'), 'Deposit')
    editor.commands.setListStyle('decimal')
    expect(json(editor).content?.[0]?.attrs?.listStyle ?? null).toBeNull()
  })

  it('starts a numbered list when the caret is not in one', () => {
    const editor = editorAt(
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plain' }] }] },
      'Plain',
    )
    editor.commands.setListStyle('lower-roman-paren')
    const list = json(editor).content?.[0]
    expect(list?.type).toBe('orderedList')
    expect(list?.attrs?.listStyle).toBe('lower-roman-paren')
  })
})

/** Type `text` one character at a time so input rules fire as they would for a keyboard. */
function type(editor: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = editor.state.selection
    const insert = () => editor.state.tr.insertText(ch, from, to)
    const handled = editor.view.someProp('handleTextInput', (f) =>
      f(editor.view, from, to, ch, insert),
    )
    if (!handled) editor.view.dispatch(insert())
  }
}

describe('autoformat by typing a marker at the start of a line', () => {
  afterEach(() => {
    editors.splice(0).forEach((e) => e.destroy())
  })

  const empty: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

  it.each([
    ['a. ', 'lower-alpha'],
    ['(a) ', 'lower-alpha-paren'],
    ['A. ', 'upper-alpha'],
    ['i. ', 'lower-roman'],
    ['(i) ', 'lower-roman-paren'],
    ['I. ', 'upper-roman'],
    ['1.1 ', 'decimal-outline'],
  ])('"%s" starts a list in the %s format', (marker, style) => {
    const editor = new Editor({ extensions: [StarterKit, ContractListStyles], content: empty })
    editors.push(editor)
    type(editor, marker)
    const list = json(editor).content?.[0]
    expect(list?.type).toBe('orderedList')
    expect(list?.attrs?.listStyle).toBe(style)
    // The marker itself is consumed, as with Word's automatic lists.
    expect(editor.state.doc.textContent).toBe('')
  })

  it('leaves "1. " to the built-in plain numbered list', () => {
    const editor = new Editor({ extensions: [StarterKit, ContractListStyles], content: empty })
    editors.push(editor)
    type(editor, '1. ')
    const list = json(editor).content?.[0]
    expect(list?.type).toBe('orderedList')
    expect(list?.attrs?.listStyle ?? null).toBeNull()
  })

  it('starts its own list after a differently numbered one, rather than joining it', () => {
    // ProseMirror's wrapping rule merges a new list into a same-type
    // neighbour, which turned "(a) " typed under a `1.` list into item 3.
    const editor = new Editor({
      extensions: [StarterKit, ContractListStyles],
      content: {
        type: 'doc',
        content: [listDoc(null).content[0] as JSONContent, { type: 'paragraph' }],
      },
    })
    editors.push(editor)
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    type(editor, '(a) ')
    // StarterKit's trailingNode adds a paragraph after a closing list; only
    // the lists matter here.
    const lists = (json(editor).content ?? []).filter((b) => b.type === 'orderedList')
    expect(lists).toHaveLength(2)
    expect(lists[1]?.attrs?.listStyle).toBe('lower-alpha-paren')
    expect(lists[0]?.attrs?.listStyle ?? null).toBeNull()
  })

  it('continues a list of the same format', () => {
    const editor = new Editor({
      extensions: [StarterKit, ContractListStyles],
      content: {
        type: 'doc',
        content: [listDoc('lower-alpha-paren').content[0] as JSONContent, { type: 'paragraph' }],
      },
    })
    editors.push(editor)
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    type(editor, '(a) ')
    const lists = (json(editor).content ?? []).filter((b) => b.type === 'orderedList')
    expect(lists).toHaveLength(1)
    expect(lists[0]?.content).toHaveLength(2)
  })

  it('does not fire mid-sentence', () => {
    const editor = new Editor({ extensions: [StarterKit, ContractListStyles], content: empty })
    editors.push(editor)
    type(editor, 'see clause (a) ')
    expect(json(editor).content?.[0]?.type).toBe('paragraph')
  })
})

/** Three levels deep, no formats set: "Fees" > "Deposit" > "Card". */
const threeDeep: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Fees' }] },
            {
              type: 'orderedList',
              attrs: { listStyle: 'upper-alpha' },
              content: [
                {
                  type: 'listItem',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Deposit' }] },
                    {
                      type: 'orderedList',
                      content: [
                        {
                          type: 'listItem',
                          content: [
                            { type: 'paragraph', content: [{ type: 'text', text: 'Card' }] },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

describe('the Legal scheme', () => {
  afterEach(() => {
    editors.splice(0).forEach((e) => e.destroy())
  })

  it('is set on the outermost list from anywhere inside it, clearing per-list formats', () => {
    const editor = editorAt(threeDeep, 'Card')
    editor.commands.setListScheme('legal')

    const root = json(editor).content?.[0]
    const level2 = root?.content?.[0]?.content?.[1]
    expect(root?.attrs?.listScheme).toBe('legal')
    // The scheme owns every level; the old `A.` override would fight it.
    expect(level2?.attrs?.listStyle ?? null).toBeNull()
  })

  it('is cleared by setting it to null', () => {
    const editor = editorAt(threeDeep, 'Fees')
    editor.commands.setListScheme('legal')
    editor.commands.setListScheme(null)
    expect(json(editor).content?.[0]?.attrs?.listScheme ?? null).toBeNull()
  })

  it('reaches the rendered list and survives the sanitiser', () => {
    const editor = editorAt(threeDeep, 'Fees')
    editor.commands.setListScheme('legal')
    const html = renderContractHtml(json(editor), vars)
    expect(html).toContain('<ol data-list-scheme="legal">')
  })

  it('drops a scheme that is not known', () => {
    const doc = { ...listDoc(null), content: [{ ...listDoc(null).content[0], attrs: { listScheme: 'x' } }] }
    expect(renderContractHtml(doc as JSONContent, vars)).not.toContain('data-list-scheme')
  })
})

describe('headings inside list items', () => {
  afterEach(() => {
    editors.splice(0).forEach((e) => e.destroy())
  })

  it('lets a numbered clause title be a heading', () => {
    // StarterKit's list item only admits a paragraph first, so H1/H2 in the
    // toolbar did nothing inside a list. The contract list item admits a
    // heading there, so "1. Definitions" can be a real heading.
    const editor = new Editor({
      extensions: [StarterKit.configure({ listItem: false }), ContractListItem, ContractListStyles],
      content: listDoc(null),
    })
    editors.push(editor)
    editor.commands.setTextSelection(3)
    editor.commands.toggleHeading({ level: 2 })
    const item = json(editor).content?.[0]?.content?.[0]
    expect(item?.type).toBe('listItem')
    expect(item?.content?.[0]?.type).toBe('heading')
  })

  /** A one-item list whose item is the given block. */
  function listOf(block: JSONContent): Editor {
    const editor = new Editor({
      extensions: [StarterKit.configure({ listItem: false }), ContractListItem, ContractListStyles],
      content: {
        type: 'doc',
        content: [{ type: 'orderedList', content: [{ type: 'listItem', content: [block] }] }],
      },
    })
    editors.push(editor)
    return editor
  }
  const h2 = (text: string): JSONContent => ({
    type: 'heading',
    attrs: { level: 2 },
    content: text ? [{ type: 'text', text }] : [],
  })
  const items = (editor: Editor) => json(editor).content?.[0]?.content ?? []
  // A real keydown through the view's keymaps. Not `commands.keyboardShortcut`:
  // that replays the captured steps through an already-advanced mapping and
  // silently drops every step after the first.
  const pressEnter = (editor: Editor) =>
    editor.view.someProp('handleKeyDown', (f) =>
      f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })),
    )

  it('keeps the heading on the next item when Enter is pressed at the end', () => {
    // Clause titles come one after another: "1. Definitions", Enter,
    // "2. Services". Stock behaviour gave the new item a paragraph, so every
    // title after the first had to be re-styled.
    const editor = listOf(h2('Definitions'))
    editor.commands.setTextSelection(3 + 'Definitions'.length)
    pressEnter(editor)
    expect(items(editor)).toHaveLength(2)
    expect(items(editor)[1]?.content?.[0]?.type).toBe('heading')
    expect(items(editor)[1]?.content?.[0]?.attrs?.level).toBe(2)
  })

  it('splits a heading in two when Enter is pressed mid-title', () => {
    const editor = listOf(h2('Definitions'))
    editor.commands.setTextSelection(3 + 'Defin'.length)
    pressEnter(editor)
    const [first, second] = items(editor)
    expect(first?.content?.[0]?.type).toBe('heading')
    expect(second?.content?.[0]?.type).toBe('heading')
    expect(second?.content?.[0]?.content?.[0]?.text).toBe('itions')
  })

  it('still leaves the list from an empty heading item', () => {
    // Enter on an empty item lifts out of the list, as in any list.
    const editor = listOf(h2(''))
    editor.commands.setTextSelection(3)
    pressEnter(editor)
    expect(json(editor).content?.[0]?.type).not.toBe('orderedList')
  })

  it('carries bold onto the next item', () => {
    // TipTap's splitListItem keeps splittable marks as stored marks; pinned
    // so a keymap change cannot silently drop it.
    const editor = listOf({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Fees', marks: [{ type: 'bold' }] }],
    })
    editor.commands.setTextSelection(3 + 'Fees'.length)
    editor.commands.splitListItem('listItem')
    expect(editor.state.storedMarks?.map((m) => m.type.name)).toEqual(['bold'])
  })

  it('renders the heading inside the list item', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Definitions' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'In this agreement:' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(renderContractHtml(doc, vars)).toBe(
      '<ol><li><h2>Definitions</h2><p>In this agreement:</p></li></ol>',
    )
  })
})

describe('effectiveListStyle', () => {
  afterEach(() => {
    editors.splice(0).forEach((e) => e.destroy())
  })

  it('is null outside a list', () => {
    const editor = editorAt(
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plain' }] }] },
      'Plain',
    )
    expect(effectiveListStyle(editor.state)).toBeNull()
  })

  it('is decimal for an unstyled list with no scheme', () => {
    const editor = editorAt(nestedDoc, 'Card')
    expect(effectiveListStyle(editor.state)).toBe('decimal')
  })

  it('reports a per-list format', () => {
    const editor = editorAt(threeDeep, 'Deposit')
    expect(effectiveListStyle(editor.state)).toBe('upper-alpha')
  })

  it('follows the Legal scheme by depth when the list has no format of its own', () => {
    const editor = editorAt(threeDeep, 'Card')
    editor.commands.setListScheme('legal')
    expect(effectiveListStyle(editor.state)).toBe('lower-alpha-paren')
    editorAt(threeDeep, 'Deposit')
    const e2 = editors[editors.length - 1] as Editor
    e2.commands.setListScheme('legal')
    expect(effectiveListStyle(e2.state)).toBe('decimal-outline')
  })

  it('lets a per-list format override the scheme', () => {
    const editor = editorAt(threeDeep, 'Card')
    editor.commands.setListScheme('legal')
    editor.commands.setListStyle('upper-roman')
    expect(effectiveListStyle(editor.state)).toBe('upper-roman')
  })
})
