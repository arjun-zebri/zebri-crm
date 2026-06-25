import { render, waitFor } from '@testing-library/react'
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from '@/components/ui/rich-text-editor'

describe('RichTextEditor signature NodeView', () => {
  const content: JSONContent = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Warm regards,' }] },
      { type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'mc.signature' } }] },
    ],
  }

  it('renders the signature mention inline as rich HTML (no chrome)', async () => {
    render(
      <RichTextEditor
        value={content}
        onChange={vi.fn()}
        mentionDisplay="label"
        signatureHtml={'<p><strong>Charlie</strong> · Acme MC</p>'}
      />,
    )
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('<strong>Charlie</strong>')
    }, { timeout: 3000 })
    // No remove button or "Your signature" label — select-and-delete instead.
    expect(document.querySelector('button[title="Remove signature"]')).toBeNull()
    expect(document.body.textContent).not.toContain('Your signature')
    // The raw {{mc.signature}} token must NOT appear (it's rendered, not a chip).
    expect(document.body.textContent).not.toContain('mc.signature')
  })

  it('shows a "no signature set" hint when none is configured', async () => {
    render(<RichTextEditor value={content} onChange={vi.fn()} mentionDisplay="label" signatureHtml={''} />)
    await waitFor(() => {
      expect(document.body.textContent).toContain('no signature set')
    }, { timeout: 3000 })
  })
})
