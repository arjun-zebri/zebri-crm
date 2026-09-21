// tests/unit/features/proposals/editor/use-rehydrate-editor.test.ts
/**
 * `useRehydrateEditor` against a headless editor, so the transaction
 * listener can be attached *before* the hook first runs (a mounted
 * `ContentSectionEditor` creates its editor internally, too late to
 * observe the mount-time decision).
 *
 * Live find (the "flushSync was called from inside a lifecycle method"
 * console warning on every editor load): the old string-fingerprint
 * comparison called a stored doc "changed" whenever the editor's own
 * JSON carried schema defaults the stored copy lacked (`title: null` on
 * a link, `caption: ''` on an image) or ordered keys differently, so
 * every such section ran a needless `setContent` inside React's commit.
 */
import { act, renderHook } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, doc, paragraph, text, useRehydrateEditor } from '@/features/proposals'

const STORED = doc(
  paragraph({ type: 'text', text: 'Hello', marks: [{ type: 'link', attrs: { href: 'https://zebri.com.au' } }] }),
  { type: 'image', attrs: { src: 'https://x/a.jpg', alt: '', layout: 'inline', widthPct: 50 } },
)

/** Counts doc-changing transactions on `editor` from now on. */
function countDocChanges(editor: Editor): () => number {
  let n = 0
  editor.on('transaction', ({ transaction }) => { if (transaction.docChanged) n += 1 })
  return () => n
}

describe('useRehydrateEditor', () => {
  it('leaves an editor alone on mount when it already shows the stored doc, defaults and key order aside', async () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: STORED })
    const changes = countDocChanges(editor)

    renderHook(() => useRehydrateEditor(editor, STORED, 0))
    await act(async () => { await Promise.resolve() })

    expect(changes()).toBe(0)
    editor.destroy()
  })

  it('re-hydrates one microtask after externalVersion bumps, keeping the caret in range', async () => {
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: STORED })
    const changes = countDocChanges(editor)
    const next = doc(paragraph(text('Bye')))

    const { rerender } = renderHook(({ content, version }) => useRehydrateEditor(editor, content, version), {
      initialProps: { content: STORED, version: 0 },
    })
    rerender({ content: next, version: 1 })
    // Not yet: the `setContent` is deferred past React's commit.
    expect(changes()).toBe(0)
    await act(async () => { await Promise.resolve() })

    expect(changes()).toBe(1)
    expect(editor.getText()).toBe('Bye')
    expect(editor.state.selection.from).toBeLessThanOrEqual(editor.state.doc.content.size)
    editor.destroy()
  })
})
