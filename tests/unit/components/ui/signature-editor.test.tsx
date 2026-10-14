import { render, waitFor } from '@testing-library/react'
import type { Editor, JSONContent } from '@tiptap/core'
import { describe, expect, it, vi } from 'vitest'

import { SignatureEditor } from '@/components/ui/signature-editor'

const linked: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Website', marks: [{ type: 'link', attrs: { href: 'https://zebri.com.au' } }] }],
    },
  ],
}

/** Every object in the tree, depth first. */
function objects(value: unknown, out: object[] = []): object[] {
  if (value && typeof value === 'object') {
    out.push(value)
    for (const v of Object.values(value)) objects(v, out)
  }
  return out
}

describe('SignatureEditor', () => {
  it('emits plain objects, so the value can be passed to a server action', async () => {
    // ProseMirror's attrs have a null prototype. Sent to a server action
    // as-is, React turned them into opaque references and the outreach
    // settings save threw "Cannot access href on the server".
    const onChange = vi.fn()
    const { container } = render(<SignatureEditor value={{ type: 'doc', content: [{ type: 'paragraph' }] }} onChange={onChange} />)
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull())
    const editor = (container.querySelector('.ProseMirror') as HTMLElement & { editor: Editor }).editor
    editor.commands.setContent(linked, { emitUpdate: true })

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const emitted = onChange.mock.lastCall?.[0] as JSONContent
    expect(emitted.content?.[0]?.content?.[0]?.marks?.[0]?.attrs?.href).toBe('https://zebri.com.au')
    const nonPlain = objects(emitted).filter((o) => !Array.isArray(o) && Object.getPrototypeOf(o) !== Object.prototype)
    expect(nonPlain).toEqual([])
  })
})
