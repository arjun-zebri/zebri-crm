/**
 * `useTemplateAutosave` (Proposal Layout v2 Phase 2 Task 14, fix round 1):
 * an invalid layout must report `'error'`, never `'saved'` for a layout
 * that was never sent (Issue 4), and a save still pending when the hook
 * unmounts must be flushed, not dropped (Issue 2).
 *
 * @module tests/unit/features/proposals/editor/use-template-autosave
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { draftKey, readDraft, useTemplateAutosave, writeDraft, type ProposalLayout } from '@/features/proposals'

const actions = vi.hoisted(() => ({ updateTemplateLayoutAction: vi.fn() }))
// `useTemplateAutosave` reaches the server action through
// `features/proposals/data/templates` internally (a relative import inside
// the module), not through the `@/features/proposals` barrel this test is
// restricted to - so the mock targets that internal path directly.
vi.mock('@/features/proposals/data/templates', () => actions)

const opts = { revision: 0, userId: 'u1' }
const layoutA: ProposalLayout = { version: 2, sections: [] }
const layoutB: ProposalLayout = { version: 2, sections: [], page: { allowDownload: true } }
// `height: 'bogus'` fails `parseProposalLayout`'s `'fit' | 'full'` enum -
// a layout the editor's own reducer could never produce, standing in for
// "a bug upstream wrote something the schema rejects".
const invalidLayout = {
  version: 2,
  sections: [{ id: 's1', kind: 'content', style: { height: 'bogus', contentWidth: 'medium', padding: 'cozy' } }],
} as unknown as ProposalLayout

describe('useTemplateAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    actions.updateTemplateLayoutAction.mockResolvedValue({ ok: true, revision: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('skips the save and reports an error status for a layout that fails parseProposalLayout', async () => {
    const { result, rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, opts), {
      initialProps: { layout: layoutA },
    })
    rerender({ layout: invalidLayout })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })
    expect(actions.updateTemplateLayoutAction).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
  })

  it('flushes a pending save on unmount instead of dropping it', async () => {
    const { rerender, unmount } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, opts), {
      initialProps: { layout: layoutA },
    })
    rerender({ layout: layoutB })
    // Still inside the 800ms debounce window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(actions.updateTemplateLayoutAction).not.toHaveBeenCalled()

    unmount()
    expect(actions.updateTemplateLayoutAction).toHaveBeenCalledTimes(1)
    expect(actions.updateTemplateLayoutAction).toHaveBeenCalledWith({ id: 't1', layout: layoutB, baseRevision: 0 })
  })

  /**
   * Root-cause regression: a hard refresh/tab close never runs the unmount
   * above (no React cleanup fires), so a pending edit needs a beacon
   * instead - see the module doc.
   */
  it('beacons the pending layout on beforeunload instead of dropping it', async () => {
    const sendBeacon = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, sendBeacon })

    const { rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, opts), {
      initialProps: { layout: layoutA },
    })
    rerender({ layout: layoutB })
    // Still inside the 800ms debounce window: nothing sent to the action yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(actions.updateTemplateLayoutAction).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('beforeunload'))

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith(
      '/api/proposals/templates/layout-beacon',
      JSON.stringify({ id: 't1', layout: layoutB, baseRevision: 0 })
    )

    vi.unstubAllGlobals()
  })

  it('does not beacon an invalid layout', async () => {
    const sendBeacon = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, sendBeacon })

    const { rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, opts), {
      initialProps: { layout: layoutA },
    })
    rerender({ layout: invalidLayout })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    window.dispatchEvent(new Event('beforeunload'))
    expect(sendBeacon).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
  /**
   * The optimistic-concurrency guard (`template-revision.test.ts` proves
   * the server side): every save carries the revision the client last had
   * confirmed, and adopts the one the server hands back.
   */
  describe('revision', () => {
    it('sends the loaded revision first, then the one the last save returned', async () => {
      actions.updateTemplateLayoutAction.mockResolvedValueOnce({ ok: true, revision: 8 })
      const { rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, { revision: 7, userId: 'u1' }), {
        initialProps: { layout: layoutA },
      })
      rerender({ layout: layoutB })
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      expect(actions.updateTemplateLayoutAction).toHaveBeenLastCalledWith({ id: 't1', layout: layoutB, baseRevision: 7 })

      rerender({ layout: layoutA })
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      expect(actions.updateTemplateLayoutAction).toHaveBeenLastCalledWith({ id: 't1', layout: layoutA, baseRevision: 8 })
    })

    it('adopts the server revision on a conflict whose content is already what the editor holds', async () => {
      actions.updateTemplateLayoutAction.mockResolvedValueOnce({ ok: false, error: 'Template changed elsewhere', conflict: { revision: 3, layout: layoutB } })
      const { result, rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, { revision: 0, userId: 'u1' }), {
        initialProps: { layout: layoutA },
      })
      rerender({ layout: layoutB })
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      expect(result.current.status).toBe('saved')

      rerender({ layout: layoutA })
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      expect(actions.updateTemplateLayoutAction).toHaveBeenLastCalledWith({ id: 't1', layout: layoutA, baseRevision: 3 })
    })

    it('reports a conflict, and stops, when the server holds different content', async () => {
      const elsewhere: ProposalLayout = { version: 2, sections: [], page: { allowDownload: false } }
      actions.updateTemplateLayoutAction.mockResolvedValue({ ok: false, error: 'Template changed elsewhere', conflict: { revision: 3, layout: elsewhere } })
      const { result, rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, { revision: 0, userId: 'u1' }), {
        initialProps: { layout: layoutA },
      })
      rerender({ layout: layoutB })
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      expect(result.current.status).toBe('conflict')
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(actions.updateTemplateLayoutAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('local draft', () => {
    it('mirrors every change into localStorage before the debounce elapses', async () => {
      const { rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, { revision: 4, userId: 'u1' }), {
        initialProps: { layout: layoutA },
      })
      rerender({ layout: layoutB })
      await act(async () => { await vi.advanceTimersByTimeAsync(50) })
      expect(readDraft(draftKey('u1', 't1'))).toMatchObject({ layout: layoutB, baseRevision: 4 })
    })

    it('clears the draft once the server confirms the same content', async () => {
      const { rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, { revision: 0, userId: 'u1' }), {
        initialProps: { layout: layoutA },
      })
      rerender({ layout: layoutB })
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      expect(readDraft(draftKey('u1', 't1'))).toBeNull()
    })

    it('keeps the draft when the save fails', async () => {
      actions.updateTemplateLayoutAction.mockRejectedValue(new Error('503'))
      const { rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout, { revision: 0, userId: 'u1' }), {
        initialProps: { layout: layoutA },
      })
      rerender({ layout: layoutB })
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      expect(readDraft(draftKey('u1', 't1'))).toMatchObject({ layout: layoutB, baseRevision: 0 })
    })

    it('saves a restored draft straight away when mounted dirty', async () => {
      writeDraft(draftKey('u1', 't1'), { layout: layoutB, baseRevision: 0, savedAt: 1 })
      renderHook(() => useTemplateAutosave('t1', layoutB, { revision: 0, userId: 'u1', initialDirty: true }))
      await act(async () => { await vi.advanceTimersByTimeAsync(900) })
      expect(actions.updateTemplateLayoutAction).toHaveBeenCalledWith({ id: 't1', layout: layoutB, baseRevision: 0 })
      expect(readDraft(draftKey('u1', 't1'))).toBeNull()
    })
  })
})
