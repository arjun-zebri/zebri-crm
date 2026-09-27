/**
 * `onReady` reports the editor's own form of the document it opened with
 * (Phase 5 live check B2): the step detail modal measures "edited"
 * against it, so it must come once, as plain JSON, with the same shape
 * `onChange` would emit for the same document.
 */
import { render, waitFor } from '@testing-library/react'
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from '@/components/ui/rich-text-editor'

const content: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hi ' },
        { type: 'mention', attrs: { id: 'couple.primary_name' } },
        { type: 'text', marks: [{ type: 'bold' }], text: 'so excited' },
      ],
    },
  ],
}

describe('RichTextEditor onReady', () => {
  it('reports the opening document once, as plain JSON', async () => {
    const onReady = vi.fn()
    render(<RichTextEditor value={content} onChange={vi.fn()} onReady={onReady} />)
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1), { timeout: 3000 })

    const doc = onReady.mock.calls[0]![0] as JSONContent
    const mention = doc.content![0]!.content![1]!
    expect(mention.attrs?.['id']).toBe('couple.primary_name')
    // Plain objects, so the id survives a server action.
    expect(Object.getPrototypeOf(mention.attrs)).toBe(Object.prototype)
    expect(doc.content![0]!.content![2]).toMatchObject({ marks: [{ type: 'bold' }], text: 'so excited' })
  })
})
