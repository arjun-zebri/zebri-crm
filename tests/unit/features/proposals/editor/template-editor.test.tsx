/**
 * `TemplateEditor` (Proposal Layout v2 Phase 2 Task 14): loads a template
 * and the account's branding, mounts the canvas with every one of its
 * sections, and autosaves a style edit - the first place all of Tasks
 * 1-13's editor pieces come together on a real component tree.
 *
 * @module tests/unit/features/proposals/editor/template-editor
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  defaultTemplateLayout, doc, draftKey, heading, newSectionFor, parseProposalLayout, readDraft, TemplateEditor, text,
  writeDraft, type ProposalLayout,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

// `TemplateEditor` reaches the template server actions through
// `features/proposals/data/templates` internally (a relative import
// inside the module, per the feature's own layering rule), not through
// the `@/features/proposals` barrel this test itself is restricted to -
// so the mock targets that internal path directly rather than the barrel.
const actions = vi.hoisted(() => ({
  getTemplateAction: vi.fn(),
  updateTemplateLayoutAction: vi.fn(),
  renameTemplateAction: vi.fn(),
}))
vi.mock('@/features/proposals/data/templates', () => actions)

const branding = buildPublicBranding({ business_name: 'Sam MC' })
vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: () => ({ branding, blocks: [], brandLabel: null, loading: false }),
}))

// jsdom has no ResizeObserver; CanvasFrame observes the scroll viewport to
// compute its fit-to-width zoom.
class ResizeObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

const layout = defaultTemplateLayout('mc')
const template = { id: 't1', name: 'My proposal', isDefault: true, updatedAt: '2026-09-16T00:00:00Z', layout, revision: 0 }

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TemplateEditor templateId="t1" userId="u1" />
    </QueryClientProvider>,
  )
}

function sectionIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-canvas-section-id]')).map((el) => el.getAttribute('data-canvas-section-id')!)
}

describe('TemplateEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    actions.getTemplateAction.mockResolvedValue({ ok: true, template })
    actions.updateTemplateLayoutAction.mockResolvedValue({ ok: true, revision: 1 })
    actions.renameTemplateAction.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    // Explicit, and first: `useTemplateAutosave`'s `flushOnUnmount` fires a
    // real (mocked) `updateTemplateLayoutAction` call from React's own
    // unmount cleanup. `vitest.setup.ts`'s global `afterEach(cleanup)` runs
    // *after* this file's own `afterEach` (inner describe hooks run before
    // outer/global ones), which would otherwise unmount - and flush - only
    // after `vi.clearAllMocks()` below had already reset this test's call
    // count, leaking that call into the next test's assertions.
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads the template and renders one editable section per layout section', async () => {
    const { container } = renderEditor()
    await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))
    expect(screen.getByRole('button', { name: `Rename ${template.name}` })).toBeInTheDocument()
  })

  it('shows a labelled "Proposals" back link, and the Preview button opens a live view of the current layout, closable by its own button, Escape, and Cmd/Ctrl+Shift+P - with focus returning to Preview every time', async () => {
    // A layout with one recognisable heading, distinct from the shared
    // `template` fixture other tests use, so "the overlay shows this
    // exact live layout" is unambiguous.
    const customLayout: ProposalLayout = {
      version: 2,
      sections: [{ ...newSectionFor('content'), content: doc(heading(1, text('Live Preview Heading'))) }],
    }
    actions.getTemplateAction.mockResolvedValue({ ok: true, template: { ...template, layout: customLayout } })
    const { container } = renderEditor()
    await waitFor(() => expect(sectionIds(container)).toHaveLength(1))

    expect(screen.getByRole('link', { name: 'Proposals' })).toHaveAttribute('href', '/proposals')

    const previewButton = screen.getByRole('button', { name: 'Preview' })
    fireEvent.click(previewButton)
    // Scoped to the overlay: the same live layout also renders in the
    // editable canvas underneath it, which never unmounts.
    expect(within(screen.getByRole('dialog', { name: 'Preview' })).getByText('Live Preview Heading')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument()
    expect(previewButton).toHaveFocus()

    // Cmd/Ctrl+Shift+P opens it from anywhere on the page, not just via the button.
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: true })
    expect(screen.getByRole('dialog', { name: 'Preview' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument()
    expect(previewButton).toHaveFocus()
  })

  it('clicking the workbench outside the page deselects the section', async () => {
    const { container } = renderEditor()
    await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))
    fireEvent.click(screen.getAllByRole('button', { name: 'Move section' })[1]!)
    expect(screen.getByRole('toolbar', { name: 'Section' })).toBeInTheDocument()
    // The scroll viewport itself, not the sheet or any section inside it.
    fireEvent.click(container.querySelector('[data-canvas-scroll]')!)
    expect(screen.queryByRole('toolbar', { name: 'Section' })).not.toBeInTheDocument()
  })

  it('a style edit autosaves after the debounce, with a layout that passes parseProposalLayout, and undo/redo track it', async () => {
    const { container } = renderEditor()
    await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))

    // sections[1] ("Note") starts height: 'fit'; clicking "Full" is a real,
    // directly-clickable style edit (no popover involved).
    const target = layout.sections[1]!
    const grips = screen.getAllByRole('button', { name: 'Move section' })
    fireEvent.click(grips[1]!)
    // The Height pill now lives behind the section toolbar's Style popover
    // (UX audit §3.5), not directly in a top-of-canvas strip.
    fireEvent.click(screen.getByRole('button', { name: 'Style' }))
    fireEvent.click(screen.getByRole('button', { name: 'Full' }))

    // Past `useHistory`'s own commit debounce (0ms for a `{ commit: true }`
    // dispatch): the edit becomes an undo step.
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })

    // Past `useAutosave`'s 800ms debounce: the layout is saved.
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    await waitFor(() => expect(actions.updateTemplateLayoutAction).toHaveBeenCalledTimes(1))
    const saved = actions.updateTemplateLayoutAction.mock.calls[0]![0] as { id: string; layout: unknown }
    expect(saved.id).toBe('t1')
    const parsed = parseProposalLayout(saved.layout)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.layout.sections.find((s) => s.id === target.id)?.style.height).toBe('full')
    }

    // No Undo/Redo buttons in the header (2026-09-18 feedback): the
    // shortcuts are the only way in. Fired at the focused "Full" pill,
    // outside any section editor, so `useHistory`'s window listener is
    // the handler (the in-editor path is `keyboard.test.tsx`'s).
    fireEvent.keyDown(screen.getByRole('button', { name: 'Full' }), { key: 'z', metaKey: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    await waitFor(() => expect(actions.updateTemplateLayoutAction).toHaveBeenCalledTimes(2))
    const undone = parseProposalLayout((actions.updateTemplateLayoutAction.mock.calls[1]![0] as { layout: unknown }).layout)
    expect(undone.ok && undone.layout.sections.find((s) => s.id === target.id)?.style.height).toBe('fit')

    fireEvent.keyDown(screen.getByRole('button', { name: 'Full' }), { key: 'z', metaKey: true, shiftKey: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    await waitFor(() => expect(actions.updateTemplateLayoutAction).toHaveBeenCalledTimes(3))
    const redone = parseProposalLayout((actions.updateTemplateLayoutAction.mock.calls[2]![0] as { layout: unknown }).layout)
    expect(redone.ok && redone.layout.sections.find((s) => s.id === target.id)?.style.height).toBe('full')
  })

  it('shows an editor-shaped skeleton (header row + page sheet), not a spinner, while the template loads', async () => {
    actions.getTemplateAction.mockReturnValue(new Promise(() => {}))
    renderEditor()
    const region = screen.getByRole('status', { name: 'Loading template' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(2)
    expect(region.querySelector('.animate-spin')).toBeNull()
  })

  it('shows "Template not found" for a missing template, not a dead-end error', async () => {
    actions.getTemplateAction.mockResolvedValue({ ok: false, error: 'Template not found' })
    renderEditor()
    expect(await screen.findByText('Template not found')).toBeInTheDocument()
    expect(screen.queryByText('Could not load this template')).not.toBeInTheDocument()
  })

  it('shows a Retry save button when the save fails, and clicking it retries', async () => {
    actions.updateTemplateLayoutAction.mockRejectedValueOnce(new Error('network down'))
    const { container } = renderEditor()
    await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))

    const grips = screen.getAllByRole('button', { name: 'Move section' })
    fireEvent.click(grips[1]!)
    // The Height pill now lives behind the section toolbar's Style popover
    // (UX audit §3.5), not directly in a top-of-canvas strip.
    fireEvent.click(screen.getByRole('button', { name: 'Style' }))
    fireEvent.click(screen.getByRole('button', { name: 'Full' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    await waitFor(() => expect(screen.getByText('Save failed')).toBeInTheDocument())

    actions.updateTemplateLayoutAction.mockResolvedValueOnce({ ok: true, revision: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }))
    // `retry()` still waits the full debounce before calling save again.
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    await waitFor(() => expect(actions.updateTemplateLayoutAction).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
  })

  it('shows the newly typed name immediately after a rename, before the refetch lands', async () => {
    const { container } = renderEditor()
    await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))

    // The post-rename refetch never resolves in this test: if the header
    // read the `name` prop instead of its own `draft`, the old name would
    // still be showing (Issue 9).
    actions.getTemplateAction.mockReturnValueOnce(new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: `Rename ${template.name}` }))
    const input = screen.getByLabelText('Template name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.blur(input)
    await waitFor(() => expect(actions.renameTemplateAction).toHaveBeenCalledWith({ id: 't1', name: 'New Name' }))
    expect(await screen.findByRole('button', { name: 'Rename New Name' })).toBeInTheDocument()
  })

  it('reverts the name field when renameTemplateAction rejects', async () => {
    const { container } = renderEditor()
    await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))

    actions.renameTemplateAction.mockRejectedValueOnce(new Error('network down'))
    fireEvent.click(screen.getByRole('button', { name: `Rename ${template.name}` }))
    const input = screen.getByLabelText('Template name')
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.blur(input)
    await waitFor(() => expect(actions.renameTemplateAction).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: `Rename ${template.name}` })).toBeInTheDocument()
  })

  it('invalidates both the template query and the Templates list query after a rename', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { container } = render(
      <QueryClientProvider client={client}>
        <TemplateEditor templateId="t1" userId="u1" />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))

    fireEvent.click(screen.getByRole('button', { name: `Rename ${template.name}` }))
    const input = screen.getByLabelText('Template name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.blur(input)
    await waitFor(() => expect(actions.renameTemplateAction).toHaveBeenCalled())

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['proposal-template', 't1'] }))
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['proposal-templates'] }))
  })

  it('keeps the editor mounted through a background refetch failure (the rename-triggered invalidation)', async () => {
    const { container } = renderEditor()
    await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))

    actions.getTemplateAction.mockRejectedValueOnce(new Error('network blip'))
    fireEvent.click(screen.getByRole('button', { name: `Rename ${template.name}` }))
    const input = screen.getByLabelText('Template name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.blur(input)

    await waitFor(() => expect(actions.getTemplateAction).toHaveBeenCalledTimes(2))
    // The background refetch failed, but the editor - and its sections -
    // stays mounted rather than unmounting into an ErrorState (Issue 5).
    expect(sectionIds(container)).toHaveLength(layout.sections.length)
    expect(screen.queryByText('Could not load this template')).not.toBeInTheDocument()
  })
  /**
   * Root-cause regressions for the 2026-09-20 "lost on refresh" report: a
   * draft the browser kept is what the editor mounts with, and is saved
   * without waiting for another edit; a real conflict is shown, not
   * silently overwritten.
   */
  describe('local draft and conflicts', () => {
    it('mounts on a local draft made on the loaded revision, and saves it straight away', async () => {
      const draftLayout: ProposalLayout = { ...layout, sections: [layout.sections[0]!] }
      writeDraft(draftKey('u1', 't1'), { layout: draftLayout, baseRevision: 0, savedAt: 1 })
      const { container } = renderEditor()
      await waitFor(() => expect(sectionIds(container)).toHaveLength(1))

      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      await waitFor(() => expect(actions.updateTemplateLayoutAction).toHaveBeenCalledTimes(1))
      // `withTheme` seeds a theme on mount, so compare the part the draft owns.
      const sent = actions.updateTemplateLayoutAction.mock.calls[0]![0] as { layout: ProposalLayout; baseRevision: number }
      expect(sent.baseRevision).toBe(0)
      expect(sent.layout.sections.map((s) => s.id)).toEqual(draftLayout.sections.map((s) => s.id))
      await waitFor(() => expect(readDraft(draftKey('u1', 't1'))).toBeNull())
    })

    it('ignores a local draft the server has moved past', async () => {
      const draftLayout: ProposalLayout = { ...layout, sections: [layout.sections[0]!] }
      writeDraft(draftKey('u1', 't1'), { layout: draftLayout, baseRevision: 0, savedAt: 1 })
      actions.getTemplateAction.mockResolvedValue({ ok: true, template: { ...template, revision: 2 } })
      const { container } = renderEditor()
      await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      // Mounting normalises the layout (theme seeding, trailing paragraph)
      // and autosaves that on its own; what matters here is that whatever
      // went out is the full server row on its revision, never the draft.
      for (const [sent] of actions.updateTemplateLayoutAction.mock.calls as [{ layout: ProposalLayout; baseRevision: number }][]) {
        expect(sent.baseRevision).toBe(2)
        expect(sent.layout.sections).toHaveLength(layout.sections.length)
      }
    })

    it('shows "Changed elsewhere" with a Reload button when the server holds different content', async () => {
      const elsewhere: ProposalLayout = { version: 2, sections: [] }
      actions.updateTemplateLayoutAction.mockResolvedValue({ ok: false, error: 'Template changed elsewhere', conflict: { revision: 5, layout: elsewhere } })
      const { container } = renderEditor()
      await waitFor(() => expect(sectionIds(container)).toHaveLength(layout.sections.length))

      const grips = screen.getAllByRole('button', { name: 'Move section' })
      fireEvent.click(grips[1]!)
      fireEvent.click(screen.getByRole('button', { name: 'Style' }))
      fireEvent.click(screen.getByRole('button', { name: 'Full' }))
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      await waitFor(() => expect(screen.getByText('Changed elsewhere')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Retry save' })).not.toBeInTheDocument()
    })
  })
})
