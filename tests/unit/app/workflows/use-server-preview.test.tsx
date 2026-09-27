/**
 * The debounced server preview hook (Task 28 fix round 1, review I2).
 *
 * Every render is keyed to the input that produced it, so a panel can
 * tell "this is the email for what is on screen" from "this is the email
 * for what WAS on screen". A render for older input must never pass as
 * current, and switching the preview off forgets it entirely.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useServerPreview } from '@/app/(dashboard)/workflows/use-server-preview'

type Res = { ok: true; data: string } | { ok: false; error: string }

/** A load whose answers the test releases by hand, in any order. */
function controlled() {
  const pending: { key: string; resolve: (r: Res) => void }[] = []
  const load = (key: string) => () =>
    new Promise<Res>((resolve) => {
      pending.push({ key, resolve })
    })
  return { pending, load }
}

function hook(initial: { key: string; enabled?: boolean }, loadFor: (key: string) => () => Promise<Res>) {
  return renderHook(
    ({ key, enabled }: { key: string; enabled?: boolean }) =>
      useServerPreview(key, loadFor(key), { enabled: enabled ?? true, delayMs: 0 }),
    { initialProps: initial },
  )
}

describe('useServerPreview', () => {
  it('marks a render current only for the input that produced it', async () => {
    const c = controlled()
    const { result, rerender } = hook({ key: 'A' }, c.load)
    await waitFor(() => expect(c.pending).toHaveLength(1))
    act(() => c.pending[0]!.resolve({ ok: true, data: 'render A' }))
    await waitFor(() => expect(result.current.current).toBe(true))
    expect(result.current.data).toBe('render A')
    expect(result.current.pending).toBe(false)

    // New input: the old render is still there, but it is not current.
    rerender({ key: 'B' })
    expect(result.current.current).toBe(false)
    expect(result.current.pending).toBe(true)

    await waitFor(() => expect(c.pending).toHaveLength(2))
    act(() => c.pending[1]!.resolve({ ok: true, data: 'render B' }))
    await waitFor(() => expect(result.current.data).toBe('render B'))
    expect(result.current.current).toBe(true)
  })

  it('never lets a slow answer for older input land as current', async () => {
    const c = controlled()
    const { result, rerender } = hook({ key: 'A' }, c.load)
    await waitFor(() => expect(c.pending).toHaveLength(1))
    rerender({ key: 'B' })
    await waitFor(() => expect(c.pending).toHaveLength(2))
    act(() => c.pending[1]!.resolve({ ok: true, data: 'render B' }))
    act(() => c.pending[0]!.resolve({ ok: true, data: 'render A' }))
    await waitFor(() => expect(result.current.data).toBe('render B'))
    expect(result.current.current).toBe(true)
  })

  it('forgets everything when switched off, so switching back on starts clean', async () => {
    const c = controlled()
    const { result, rerender } = hook({ key: 'A' }, c.load)
    await waitFor(() => expect(c.pending).toHaveLength(1))
    act(() => c.pending[0]!.resolve({ ok: true, data: 'render A' }))
    await waitFor(() => expect(result.current.data).toBe('render A'))

    rerender({ key: 'saved', enabled: false })
    expect(result.current.data).toBeNull()

    rerender({ key: 'B', enabled: true })
    expect(result.current.data).toBeNull()
    expect(result.current.pending).toBe(true)
  })

  it('ignores an answer that lands after the preview was switched off', async () => {
    const c = controlled()
    const { result, rerender } = hook({ key: 'A' }, c.load)
    await waitFor(() => expect(c.pending).toHaveLength(1))
    rerender({ key: 'saved', enabled: false })
    act(() => c.pending[0]!.resolve({ ok: true, data: 'render A' }))
    rerender({ key: 'B', enabled: true })
    expect(result.current.data).toBeNull()
  })

  it('keys an error to its input and can retry', async () => {
    const c = controlled()
    const { result } = hook({ key: 'A' }, c.load)
    await waitFor(() => expect(c.pending).toHaveLength(1))
    act(() => c.pending[0]!.resolve({ ok: false, error: 'boom' }))
    await waitFor(() => expect(result.current.error).toBe('boom'))
    expect(result.current.pending).toBe(false)

    act(() => result.current.retry())
    await waitFor(() => expect(c.pending).toHaveLength(2))
    act(() => c.pending[1]!.resolve({ ok: true, data: 'render A' }))
    await waitFor(() => expect(result.current.current).toBe(true))
    expect(result.current.error).toBeNull()
  })
})
