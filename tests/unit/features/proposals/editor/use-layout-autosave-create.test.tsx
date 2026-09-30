/**
 * The autosave mounted on a proposal that does not exist yet
 * (`/proposals/design/new`): the row has to appear on the first real
 * change and never before it, and never twice.
 *
 * This is the founder's report from 2026-09-23 ("it increases the
 * proposal count when youve quit out of it") expressed as a test: opening
 * the editor, looking around and leaving must write nothing at all.
 *
 * @module tests/unit/features/proposals/editor/use-layout-autosave-create
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLayoutAutosave, type LayoutTarget, type ProposalLayout } from '@/features/proposals'

const actions = vi.hoisted(() => ({ updateProposalLayoutAction: vi.fn(), renameProposalAction: vi.fn(), getProposalDesignAction: vi.fn() }))
// The hook reaches the server action through the feature-internal path,
// not the barrel this test imports from, so the mock targets that.
vi.mock('@/features/proposals/data/proposals', () => actions)

const layoutA: ProposalLayout = { version: 2, sections: [] }
const layoutB: ProposalLayout = { version: 2, sections: [], page: { allowDownload: true } }
const opts = { revision: 0, userId: 'u1' }

/** A target whose row is created on demand, with a spy standing in for `createProposalFromTemplateAction`. */
function uncreated(create: () => Promise<{ id: string; revision: number }>, onCreated?: (id: string) => void): LayoutTarget {
  return { kind: 'proposal', id: null, create, ...(onCreated ? { onCreated } : {}) }
}

describe('useLayoutAutosave on an uncreated proposal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    actions.updateProposalLayoutAction.mockResolvedValue({ ok: true, revision: 6 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('creates nothing when the editor is opened and closed without a change', async () => {
    const create = vi.fn()
    const { unmount } = renderHook(() => useLayoutAutosave(uncreated(create), layoutA, opts))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(create).not.toHaveBeenCalled()
    expect(actions.updateProposalLayoutAction).not.toHaveBeenCalled()
    // Nothing to key a draft on either, so `localStorage` stays clean.
    expect(localStorage.length).toBe(0)
  })

  it('creates the row on the first change, then saves the layout into the row at the revision it starts at', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'p-new', revision: 0 })
    const onCreated = vi.fn()
    const { rerender } = renderHook(({ layout }) => useLayoutAutosave(uncreated(create, onCreated), layout, opts), {
      initialProps: { layout: layoutA },
    })
    rerender({ layout: layoutB })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })

    expect(create).toHaveBeenCalledTimes(1)
    expect(onCreated).toHaveBeenCalledWith('p-new')
    expect(actions.updateProposalLayoutAction).toHaveBeenCalledTimes(1)
    expect(actions.updateProposalLayoutAction).toHaveBeenCalledWith({ id: 'p-new', layout: layoutB, baseRevision: 0 })
  })

  it('only ever creates one proposal, however many changes race for it', async () => {
    // Deliberately slow, so the second and third changes arrive while the
    // create is still in flight - the shape a real network gives.
    const create = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ id: 'p-new', revision: 0 }), 500)),
    )
    const { rerender } = renderHook(({ layout }) => useLayoutAutosave(uncreated(create), layout, opts), {
      initialProps: { layout: layoutA },
    })
    rerender({ layout: layoutB })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(850)
    })
    rerender({ layout: { ...layoutB, page: { allowDownload: false } } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(create).toHaveBeenCalledTimes(1)
    const ids = actions.updateProposalLayoutAction.mock.calls.map((call) => (call[0] as { id: string }).id)
    expect(new Set(ids)).toEqual(new Set(['p-new']))
  })

  it('does not create a proposal for a layout its own schema rejects', async () => {
    const create = vi.fn()
    // `height: 'bogus'` fails the section style enum: a layout the editor
    // could not have produced, standing in for a bug upstream. It must not
    // be the reason a couple gets a proposal row.
    const invalid = {
      version: 2,
      sections: [{ id: 's1', kind: 'content', style: { height: 'bogus', contentWidth: 'medium', padding: 'cozy' } }],
    } as unknown as ProposalLayout
    const { rerender, result } = renderHook(({ layout }) => useLayoutAutosave(uncreated(create), layout, opts), {
      initialProps: { layout: layoutA },
    })
    rerender({ layout: invalid })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })
    expect(create).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
  })
})
