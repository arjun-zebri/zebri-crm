// tests/unit/features/proposals/editor/content-section-editor.test.tsx
/**
 * Task 5: `ContentSectionEditor` mounts one TipTap editor per content
 * section, streams normalised edits back out, re-hydrates when
 * `externalVersion` bumps (undo/redo, "Reset style") but never on a plain
 * `content` change on its own (Phase 2 fix report - a stale `content`
 * prop from a sync mid-transaction re-render must never reset the
 * editor), reports atom node selections, and registers itself in
 * `editor-registry.ts` for the lifetime of the mount.
 */
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CONTENT_PLACEHOLDER, ContentSectionEditor, doc, getEditor, paragraph, spacer, text, defaultTheme } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const SAMPLE_BRANDING = buildPublicBranding({ business_name: 'Sam MC' })
const SAMPLE_THEME = defaultTheme(SAMPLE_BRANDING)

/** Wait for `sectionId`'s editor to be registered and return it. */
async function waitForEditor(sectionId: string) {
  await waitFor(() => expect(getEditor(sectionId)).not.toBeNull())
  return getEditor(sectionId)!
}

describe('ContentSectionEditor', () => {
  it('emits normalised JSON on change and registers its editor', async () => {
    const onChange = vi.fn()
    render(
      <ContentSectionEditor
        sectionId="s1"
        content={doc(paragraph(text('Hello')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
    const editor = await waitForEditor('s1')
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, '!')
    })
    const last = onChange.mock.calls.at(-1)?.[1]
    expect(JSON.stringify(last)).toContain('Hello!')
    expect(JSON.stringify(last)).not.toContain('null')
  })

  it('re-hydrates when externalVersion bumps alongside the content prop', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ContentSectionEditor
        sectionId="s2"
        content={doc(paragraph(text('First')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('s2')
    expect(screen.getByText('First')).toBeInTheDocument()

    onChange.mockClear()
    // `externalVersion` bumps, matching `useLayoutEditor` on undo/redo/
    // `replaceLayout` - only then does the new `content` reach the editor.
    rerender(
      <ContentSectionEditor
        sectionId="s2"
        content={doc(paragraph(text('Second')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={1}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument())
    // setContent runs with { emitUpdate: false }: an externally pushed
    // value must never bounce back through onChange as if the user typed it.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not re-hydrate (or reset the caret) when content is unchanged after normalisation', async () => {
    const onChange = vi.fn()
    const content = doc(paragraph(text('Stable')))
    const { rerender } = render(
      <ContentSectionEditor
        sectionId="s3"
        content={content}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('s3')
    act(() => editor.commands.setTextSelection(2))
    // `editor.commands` is a getter that rebuilds a brand-new plain object
    // on every access (`CommandManager.get commands()`), so spying on one
    // snapshot of it never sees a real call; `editor.state.doc` is the
    // reliable signal instead - ProseMirror only replaces it when a
    // transaction is actually dispatched, so its identity staying put
    // proves no command (setContent included) ran.
    const docBefore = editor.state.doc
    // A new object, same content, AND externalVersion bumps (so the
    // re-hydration effect actually runs and its fingerprint check is what
    // is really being exercised here, not just a dependency-array bailout).
    rerender(
      <ContentSectionEditor
        sectionId="s3"
        content={doc(paragraph(text('Stable')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={1}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    expect(editor.state.doc).toBe(docBefore)
    expect(editor.state.selection.from).toBe(2)
  })

  it('does not re-hydrate when content differs from the editor only by a null attr', async () => {
    const onChange = vi.fn()
    // No `textAlign` attr on the way in: TipTap's TextAlign extension still
    // fills the schema default (`null`) once the editor parses it, so
    // `editor.getJSON()` comes back carrying `attrs: { textAlign: null }`
    // even though this literal never set one.
    const initial = doc(paragraph(text('Stable')))
    const { rerender } = render(
      <ContentSectionEditor
        sectionId="s6"
        content={initial}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('s6')
    onChange.mockClear()
    // See the note above: doc identity, not a spy on the `commands`
    // getter, is what actually proves `setContent` did not run.
    const docBefore = editor.state.doc

    // A raw (un-normalised) prop carrying the same null attr explicitly,
    // as `editor/state.ts`'s `setContent` reducer case (`toPlainJSON`
    // only, no null-attr stripping) or an un-normalised `replaceLayout`
    // (undo/redo, template load) could hand in. externalVersion bumps, so
    // the fingerprint check below actually runs.
    const rawWithNullAttr = {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Stable' }] }],
    }
    rerender(
      <ContentSectionEditor
        sectionId="s6"
        content={rawWithNullAttr}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={1}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    expect(editor.state.doc).toBe(docBefore)
    expect(onChange).not.toHaveBeenCalled()
  })

  // Live-verified bug (Phase 2 fix report): the slash menu's `deleteRange`
  // + insert runs as two ProseMirror transactions; `onUpdate` from the
  // first one can force a synchronous re-render (a `useSyncExternalStore`
  // subscriber elsewhere in the tree, e.g. a node bar) before the layout
  // reducer's resulting `content` prop makes it back down through React -
  // so this component re-renders holding the *pre-transaction* `content`.
  // Re-hydrating off that stale prop reset the very edit in flight. The
  // fix: only `externalVersion` bumping (undo, redo, `replaceLayout`) may
  // re-hydrate; a `content` change on its own, however stale or fresh,
  // must not.
  it('ignores a stale content prop re-render mid-transaction, re-hydrating only once externalVersion bumps', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ContentSectionEditor
        sectionId="s7"
        content={doc(paragraph(text('Hello')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('s7')

    // The "in-flight edit" half of the repro: a transaction lands in the
    // live editor before its normalised JSON has round-tripped back into
    // this component's `content` prop.
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, 'x')
    })
    expect(screen.getByText('Hellox')).toBeInTheDocument()

    // The "stale re-render" half: a FRESH object (every real dispatch
    // produces a new reference via `toPlainJSON`/spread, so reusing the
    // same object here would let React's dependency-array check bail out
    // the effect for the wrong reason) carrying the same, now-stale,
    // "Hello" value, at the same `externalVersion` - must be a no-op, not
    // a reset back to "Hello".
    rerender(
      <ContentSectionEditor
        sectionId="s7"
        content={doc(paragraph(text('Hello')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    expect(screen.getByText('Hellox')).toBeInTheDocument()

    // A real external change (`externalVersion` bumps, as `useLayoutEditor`
    // does on undo/redo/`replaceLayout`): now it re-hydrates.
    const contentB = doc(paragraph(text('Second')))
    rerender(
      <ContentSectionEditor
        sectionId="s7"
        content={contentB}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={1}
        onChange={onChange}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument())
  })

  it('reports an atom node selection and reports null once the selection leaves it', async () => {
    const onNodeSelect = vi.fn()
    render(
      <ContentSectionEditor
        sectionId="s4"
        content={doc(paragraph(text('Hi')), spacer(24))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={onNodeSelect}
      />,
    )
    const editor = await waitForEditor('s4')
    // The spacer node sits right after the paragraph; find its position.
    let spacerPos = -1
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'spacer') spacerPos = pos
    })
    expect(spacerPos).toBeGreaterThan(-1)

    act(() => {
      editor.commands.setNodeSelection(spacerPos)
    })
    expect(onNodeSelect).toHaveBeenLastCalledWith({ sectionId: 's4', nodeType: 'spacer', pos: spacerPos })

    onNodeSelect.mockClear()
    act(() => {
      editor.commands.setTextSelection(1)
    })
    expect(onNodeSelect).toHaveBeenLastCalledWith(null)

    // Selecting another plain-text caret must not re-fire the same null value.
    onNodeSelect.mockClear()
    act(() => {
      editor.commands.setTextSelection(2)
    })
    expect(onNodeSelect).not.toHaveBeenCalled()
  })

  it('reports the enclosing table (at the table\'s own position) while the caret is in a cell, and null once it leaves', async () => {
    const onNodeSelect = vi.fn()
    const cell = (label: string) => ({ type: 'tableCell', content: [paragraph(text(label))] })
    render(
      <ContentSectionEditor
        sectionId="s5"
        content={doc(paragraph(text('Before')), { type: 'table', content: [{ type: 'tableRow', content: [cell('a'), cell('b')] }] })}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={onNodeSelect}
      />,
    )
    const editor = await waitForEditor('s5')
    let tablePos = -1
    let secondCellText = -1
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'table') tablePos = pos
      if (node.type.name === 'tableCell' && node.textContent === 'b') secondCellText = pos + 2
    })

    act(() => {
      editor.commands.setTextSelection(secondCellText)
    })
    expect(onNodeSelect).toHaveBeenLastCalledWith({ sectionId: 's5', nodeType: 'table', pos: tablePos })

    // Moving between cells of the same table is not a new report.
    onNodeSelect.mockClear()
    act(() => {
      editor.commands.setTextSelection(tablePos + 4)
    })
    expect(onNodeSelect).not.toHaveBeenCalled()

    act(() => {
      editor.commands.setTextSelection(1)
    })
    expect(onNodeSelect).toHaveBeenLastCalledWith(null)
  })

  it('unregisters its editor on unmount', async () => {
    const { unmount } = render(
      <ContentSectionEditor
        sectionId="s5"
        content={doc(paragraph(text('Bye')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('s5')
    unmount()
    expect(getEditor('s5')).toBeNull()
  })

  it('does not demote a node selection to section level when the editor gains focus', async () => {
    const onFocusSection = vi.fn()
    render(
      <ContentSectionEditor
        sectionId="s5"
        content={doc(paragraph(text('Hi')), spacer(24))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={onFocusSection}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('s5')
    let spacerPos = -1
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'spacer') spacerPos = pos
    })
    // The insert paths select the node and then focus the editor; that
    // focus must not fire the section-level `select` that would clear it.
    act(() => {
      editor.commands.setNodeSelection(spacerPos)
      editor.view.dom.dispatchEvent(new FocusEvent('focus'))
    })
    expect(onFocusSection).not.toHaveBeenCalled()
    // A plain caret focus still reports the section.
    act(() => {
      editor.commands.setTextSelection(1)
      editor.view.dom.dispatchEvent(new FocusEvent('focus'))
    })
    expect(onFocusSection).toHaveBeenCalledWith('s5')
  })

  it('shows the empty-doc placeholder on a fresh, empty content section', async () => {
    const { container } = render(
      <ContentSectionEditor
        sectionId="s6"
        content={doc(paragraph())}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('s6')
    const placeholderNode = container.querySelector('[data-placeholder]')
    expect(placeholderNode).not.toBeNull()
    expect(placeholderNode).toHaveAttribute('data-placeholder', CONTENT_PLACEHOLDER)
  })
})
