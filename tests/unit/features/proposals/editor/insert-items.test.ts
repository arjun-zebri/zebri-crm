// tests/unit/features/proposals/editor/insert-items.test.ts
/**
 * Task 8: `INSERT_ITEMS`, the single list the slash menu and the text
 * bar's `+` both run. Covers one item per insertable node type;
 * `divider` is exercised end to end against a real (headless) TipTap
 * editor, and the picker-backed items (image/audio/embed/variable)
 * against the `proposalEditor` storage callback they call - `embed` in
 * particular never inserts a node of its own (final review Finding 2:
 * `insert-media-host.tsx`'s `EmbedInsertModal` is the only thing that
 * inserts one, covered end to end in `insert-media.test.tsx`).
 */
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, doc, INSERT_ITEMS, paragraph } from '@/features/proposals'

/** A fresh headless editor over one empty paragraph, with the full v2 extension set. */
function makeEditor(): Editor {
  return new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
}

/** Every node type name appearing anywhere in the editor's current document. */
function nodeTypeNames(editor: Editor): Set<string> {
  const names = new Set<string>()
  editor.state.doc.descendants((node) => {
    names.add(node.type.name)
  })
  return names
}

describe('INSERT_ITEMS', () => {
  it('covers heading (x3), image, button, columns (x2), embed, audio, divider, spacer, table and variable', () => {
    expect(INSERT_ITEMS.map((item) => item.id)).toEqual([
      'heading1', 'heading2', 'heading3', 'image', 'button', 'columns2', 'columns3',
      'embed', 'audio', 'divider', 'spacer', 'table', 'variable',
    ])
  })

  it('running the divider item inserts a horizontalRule', () => {
    const editor = makeEditor()
    INSERT_ITEMS.find((i) => i.id === 'divider')!.run(editor)
    expect(nodeTypeNames(editor).has('horizontalRule')).toBe(true)
    editor.destroy()
  })

  it('running the button item inserts a button node', () => {
    const editor = makeEditor()
    INSERT_ITEMS.find((i) => i.id === 'button')!.run(editor)
    expect(nodeTypeNames(editor).has('button')).toBe(true)
    editor.destroy()
  })

  it('running the columns2/columns3 items inserts a columns row with that many columns', () => {
    const editor = makeEditor()
    INSERT_ITEMS.find((i) => i.id === 'columns3')!.run(editor)
    let columnCount = 0
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'columns') columnCount = node.attrs.count
    })
    expect(columnCount).toBe(3)
    editor.destroy()
  })

  it('running the spacer item inserts a spacer node with the default height', () => {
    const editor = makeEditor()
    INSERT_ITEMS.find((i) => i.id === 'spacer')!.run(editor)
    let heightPx: unknown
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'spacer') heightPx = node.attrs.heightPx
    })
    expect(heightPx).toBe(24)
    editor.destroy()
  })

  it('running the table item inserts a table', () => {
    const editor = makeEditor()
    INSERT_ITEMS.find((i) => i.id === 'table')!.run(editor)
    expect(nodeTypeNames(editor).has('table')).toBe(true)
    editor.destroy()
  })

  it('running heading1/heading2/heading3 toggles that heading level', () => {
    const editor = makeEditor()
    INSERT_ITEMS.find((i) => i.id === 'heading2')!.run(editor)
    let level: unknown
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') level = node.attrs.level
    })
    expect(level).toBe(2)
    editor.destroy()
  })

  it('image/audio/embed/variable items are a silent no-op before a bar registers their callback', () => {
    const editor = makeEditor()
    expect(() => INSERT_ITEMS.find((i) => i.id === 'image')!.run(editor)).not.toThrow()
    expect(() => INSERT_ITEMS.find((i) => i.id === 'audio')!.run(editor)).not.toThrow()
    expect(() => INSERT_ITEMS.find((i) => i.id === 'embed')!.run(editor)).not.toThrow()
    expect(() => INSERT_ITEMS.find((i) => i.id === 'variable')!.run(editor)).not.toThrow()
    editor.destroy()
  })

  it('the embed item never inserts a bare placeholder node when requestEmbed has no callback registered (final review Finding 2)', () => {
    const editor = makeEditor()
    const before = editor.getJSON()
    INSERT_ITEMS.find((i) => i.id === 'embed')!.run(editor)
    expect(editor.getJSON()).toEqual(before)
    expect(nodeTypeNames(editor).has('embed')).toBe(false)
    editor.destroy()
  })

  it('the image item calls requestImage once registered via setProposalEditorCallbacks', () => {
    const editor = makeEditor()
    let called = false
    editor.commands.setProposalEditorCallbacks({ requestImage: () => { called = true } })
    INSERT_ITEMS.find((i) => i.id === 'image')!.run(editor)
    expect(called).toBe(true)
    editor.destroy()
  })

  it('the embed item calls requestEmbed once registered via setProposalEditorCallbacks', () => {
    const editor = makeEditor()
    let called = false
    editor.commands.setProposalEditorCallbacks({ requestEmbed: () => { called = true } })
    INSERT_ITEMS.find((i) => i.id === 'embed')!.run(editor)
    expect(called).toBe(true)
    editor.destroy()
  })

  it('setProposalEditorCallbacks merges rather than replaces the callback set', () => {
    const editor = makeEditor()
    let images = 0
    let audios = 0
    editor.commands.setProposalEditorCallbacks({ requestImage: () => { images += 1 } })
    editor.commands.setProposalEditorCallbacks({ requestAudio: () => { audios += 1 } })
    INSERT_ITEMS.find((i) => i.id === 'image')!.run(editor)
    INSERT_ITEMS.find((i) => i.id === 'audio')!.run(editor)
    expect(images).toBe(1)
    expect(audios).toBe(1)
    editor.destroy()
  })
})
