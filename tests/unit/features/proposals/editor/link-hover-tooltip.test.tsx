/**
 * `LinkHoverTooltip`: hovering a link inside a section editor shows its
 * href and the Cmd/Ctrl-click hint (`extensions/link-click.ts` gates real
 * navigation behind that modifier), moving off it hides the tooltip
 * again, and moving between a link's own child nodes doesn't flicker it.
 *
 * @module tests/unit/features/proposals/editor/link-hover-tooltip
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, doc, LinkHoverTooltip, paragraph, text } from '@/features/proposals'

/** A real, DOM-mounted editor (via `EditorContent`, unlike `text-bar.test.tsx`'s offscreen harness) holding a link so its `<a>` has a real bounding rect and DOM position to hover. */
function Harness({ onReady }: { onReady: (editor: Editor) => void }) {
  const editor = useEditor({
    extensions: buildRichDocExtensions({}),
    content: doc(paragraph(
      text('Click '),
      text('here', [{ type: 'link', attrs: { href: 'https://zebri.com.au' } }]),
      text(' now'),
    )),
    immediatelyRender: false,
  })
  useEffect(() => {
    if (editor) onReady(editor)
  }, [editor, onReady])
  if (!editor) return null
  return (
    <>
      <EditorContent editor={editor} />
      <LinkHoverTooltip editor={editor} />
    </>
  )
}

async function setup(): Promise<Editor> {
  let current: Editor | null = null
  render(<Harness onReady={(e) => { current = e }} />)
  await waitFor(() => expect(current).not.toBeNull())
  return current!
}

describe('LinkHoverTooltip', () => {
  it('shows the href and the Cmd/Ctrl-click hint on hover, and hides on mouseout', async () => {
    const editor = await setup()
    const link = editor.view.dom.querySelector('a[href]') as HTMLAnchorElement
    expect(link).not.toBeNull()

    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.mouseOver(link)
    expect(screen.getByRole('tooltip')).toHaveTextContent('https://zebri.com.au')
    expect(screen.getByRole('tooltip')).toHaveTextContent('⌘/Ctrl-click to open')

    fireEvent.mouseOut(link, { relatedTarget: editor.view.dom })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('does not flicker when the pointer moves between a link\'s own child nodes', async () => {
    const editor = await setup()
    const link = editor.view.dom.querySelector('a[href]') as HTMLAnchorElement
    const child = link.firstChild as Node

    fireEvent.mouseOver(link)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    // Leaving the link but landing on its own child (relatedTarget inside
    // it) must not close the tooltip.
    fireEvent.mouseOut(link, { relatedTarget: child })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('renders nothing while no link is hovered', async () => {
    const editor = await setup()
    expect(editor.view.dom.querySelector('a[href]')).not.toBeNull()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
