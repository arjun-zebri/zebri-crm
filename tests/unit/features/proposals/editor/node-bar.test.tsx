// tests/unit/features/proposals/editor/node-bar.test.tsx
/**
 * Task 11: `NodeBar`, the per-node control bar shown when an atom node
 * (image, button, embed, audio, columns, spacer) is selected. Mirrors
 * `text-bar.test.tsx`'s own harness: a bare editor built directly with
 * `buildRichDocExtensions({})`, no `EditorContent` mount, `NodeBar`
 * rendered against it headlessly. Every fixture doc wraps the node
 * under test as the doc's sole child, so `pos` (a `NodeSelection`'s own
 * start) is always `0` - no need to search the live doc for it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'

import {
  button, buildRichDocExtensions, column, columns, doc, embed, EMBED_ERROR, image, NodeBar, paragraph, spacer, text,
} from '@/features/proposals'

/** A bare, unmounted editor holding `content`, with `NodeBar` rendered against a `NodeSelection` on `nodeType` at position 0. */
function Harness({ content, nodeType, onReady }: { content: JSONContent; nodeType: string; onReady: (editor: Editor) => void }) {
  const editor = useEditor({ extensions: buildRichDocExtensions({}), content, immediatelyRender: false })
  useEffect(() => {
    if (!editor) return
    editor.commands.setNodeSelection(0)
    onReady(editor)
  }, [editor, onReady])
  if (!editor) return null
  return <NodeBar node={{ sectionId: 's1', nodeType, pos: 0 }} editor={editor} />
}

/** Renders the harness and waits for the editor (and `NodeBar`) to exist. */
async function setup(content: JSONContent, nodeType: string): Promise<Editor> {
  let current: Editor | null = null
  render(<Harness content={content} nodeType={nodeType} onReady={(e) => { current = e }} />)
  await waitFor(() => expect(current).not.toBeNull())
  return current!
}

describe('NodeBar', () => {
  it('image: role="toolbar" aria-label="Image", and the layout pill writes attrs.layout', async () => {
    const editor = await setup(doc(image({ src: 'https://x/y.jpg', alt: 'A couple', layout: 'inline', widthPct: 100 })), 'image')
    expect(screen.getByRole('toolbar', { name: 'Image' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Left' }))
    expect(editor.state.doc.nodeAt(0)?.attrs.layout).toBe('left')
  })

  it('button: aria-label="Button", and the label input writes attrs.label', async () => {
    const editor = await setup(doc(button({ label: 'Book now', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'left' })), 'button')
    expect(screen.getByRole('toolbar', { name: 'Button' })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Button label' }), { target: { value: 'Reserve' } })
    expect(editor.state.doc.nodeAt(0)?.attrs.label).toBe('Reserve')
  })

  it('embed: aria-label="Embed", and Replace link rejects a disallowed host', async () => {
    const editor = await setup(doc(embed('https://www.youtube.com/watch?v=abc')), 'embed')
    expect(screen.getByRole('toolbar', { name: 'Embed' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Embed link' }), { target: { value: 'https://evil.example/x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(screen.getByText(EMBED_ERROR)).toBeInTheDocument()
    // Rejected: the original, allowlisted url is untouched.
    expect(editor.state.doc.nodeAt(0)?.attrs.url).toBe('https://www.youtube.com/watch?v=abc')
  })

  it('audio: aria-label="Audio", and Remove deletes the node', async () => {
    const editor = await setup({ type: 'doc', content: [{ type: 'audio', attrs: { src: null, title: 'Processional' } }] }, 'audio')
    expect(screen.getByRole('toolbar', { name: 'Audio' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    let stillThere = false
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'audio') stillThere = true
    })
    expect(stillThere).toBe(false)
  })

  it('columns: aria-label="Columns", and the 3 pill grows to three equal-ratio columns', async () => {
    const editor = await setup(doc(columns(column(0.5, paragraph(text('A'))), column(0.5, paragraph(text('B'))))), 'columns')
    expect(screen.getByRole('toolbar', { name: 'Columns' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '3' }))

    const node = editor.state.doc.nodeAt(0)
    expect(node?.attrs.count).toBe(3)
    expect(node?.childCount).toBe(3)
    node?.forEach((child) => expect(child.attrs.ratio).toBeCloseTo(1 / 3, 2))
  })

  it('spacer: aria-label="Spacer", and the stepper writes attrs.heightPx', async () => {
    const editor = await setup(doc(spacer(24)), 'spacer')
    expect(screen.getByRole('toolbar', { name: 'Spacer' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Increase Height' }))
    expect(editor.state.doc.nodeAt(0)?.attrs.heightPx).toBe(32)
  })

  it('renders nothing for an unrecognised node type', async () => {
    const editor = await setup(doc(spacer(24)), 'unknownType')
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(editor).toBeTruthy()
  })
})
