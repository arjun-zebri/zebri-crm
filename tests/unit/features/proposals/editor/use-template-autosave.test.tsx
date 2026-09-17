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

import { useTemplateAutosave, type ProposalLayout } from '@/features/proposals'

const actions = vi.hoisted(() => ({ updateTemplateLayoutAction: vi.fn() }))
// `useTemplateAutosave` reaches the server action through
// `features/proposals/data/templates` internally (a relative import inside
// the module), not through the `@/features/proposals` barrel this test is
// restricted to - so the mock targets that internal path directly.
vi.mock('@/features/proposals/data/templates', () => actions)

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
    actions.updateTemplateLayoutAction.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('skips the save and reports an error status for a layout that fails parseProposalLayout', async () => {
    const { result, rerender } = renderHook(({ layout }) => useTemplateAutosave('t1', layout), {
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
    const { rerender, unmount } = renderHook(({ layout }) => useTemplateAutosave('t1', layout), {
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
    expect(actions.updateTemplateLayoutAction).toHaveBeenCalledWith({ id: 't1', layout: layoutB })
  })
})
