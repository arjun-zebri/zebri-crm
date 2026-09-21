/**
 * Unit tests for useAutosave hook with retry functionality.
 * Tests autosave debouncing, error handling, and manual retry.
 */
import { renderHook, act } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { AutosaveConflictError, useAutosave } from '@/lib/branding/use-autosave'

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with idle status', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave({ count: 0 }, saveFn))

    expect(result.current.status).toBe('idle')
    expect(result.current.lastSavedAt).toBeNull()
  })

  it('debounces save calls when value changes', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ value }) => useAutosave(value, saveFn, 500),
      { initialProps: { value: { count: 0 } } }
    )

    act(() => {
      rerender({ value: { count: 1 } })
    })
    expect(saveFn).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(saveFn).toHaveBeenCalledWith({ count: 1 })
  })

  it('transitions through saving and saved states on success', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender, result } = renderHook(
      ({ value }) => useAutosave(value, saveFn, 100),
      { initialProps: { value: { count: 0 } } }
    )

    act(() => {
      rerender({ value: { count: 1 } })
    })

    expect(result.current.status).toBe('saving')

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Wait for the async save to complete
    await vi.waitFor(() => {
      expect(result.current.status).toBe('saved')
    })
    expect(result.current.lastSavedAt).not.toBeNull()
  })

  it('sets error status when save fails', async () => {
    const saveFn = vi.fn().mockRejectedValue(new Error('Save failed'))
    const { rerender, result } = renderHook(
      ({ value }) => useAutosave(value, saveFn, 100),
      { initialProps: { value: { count: 0 } } }
    )

    act(() => {
      rerender({ value: { count: 1 } })
    })

    expect(result.current.status).toBe('saving')

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Wait for the async save to complete
    await vi.waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })

  /**
   * Core test: retry clears error and retries save.
   * Verifies error -> saving -> saved transition after retry() call.
   */
  it('retries save after error; transitions error -> saving -> saved', async () => {
    let callCount = 0
    const saveFn = vi.fn().mockImplementation(() => {
      callCount += 1
      if (callCount === 1) {
        return Promise.reject(new Error('First save failed'))
      }
      return Promise.resolve(undefined)
    })

    const { rerender, result } = renderHook(
      ({ value }) => useAutosave(value, saveFn, 100),
      { initialProps: { value: { count: 0 } } }
    )

    // Trigger first save attempt (will fail)
    act(() => {
      rerender({ value: { count: 1 } })
    })
    expect(result.current.status).toBe('saving')

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Wait for error status to be set
    await vi.waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    // Retry: should clear error and re-save with latest value
    act(() => {
      result.current.retry()
    })
    expect(result.current.status).toBe('saving')

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Wait for saved status
    await vi.waitFor(() => {
      expect(result.current.status).toBe('saved')
    })
    expect(result.current.lastSavedAt).not.toBeNull()
    expect(saveFn).toHaveBeenCalledTimes(2)
    expect(saveFn).toHaveBeenNthCalledWith(1, { count: 1 })
    expect(saveFn).toHaveBeenNthCalledWith(2, { count: 1 })
  })

  it('returns retry function in the hook result', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave({ count: 0 }, saveFn))

    expect(typeof result.current.retry).toBe('function')
  })

  it('does not re-save if value has not changed', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ value }) => useAutosave(value, saveFn, 100),
      { initialProps: { value: { count: 0 } } }
    )

    // First value triggers save
    act(() => {
      rerender({ value: { count: 1 } })
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(saveFn).toHaveBeenCalledTimes(1)

    // Same value should not trigger save
    act(() => {
      rerender({ value: { count: 1 } })
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  /**
   * Root-cause regression for the "autosave reverts to an older version"
   * report: the debounce only ever guarded against a second *timer*
   * starting while one was still pending, not against a second *save()*
   * firing while an earlier one's promise was still unresolved (slow/
   * variable network). Two overlapping requests can land at the server out
   * of order - whichever response arrives last wins, silently overwriting
   * newer content with older. The fix serializes saves: a value change
   * that lands while one is in flight is queued and sent (with the latest
   * value at that point) only once the in-flight one settles, so only one
   * save is ever on the wire at a time and completion order always matches
   * send order.
   */
  it('never starts a new save while one is still in flight; queues the latest value for once it settles', async () => {
    let resolveFirst: (() => void) | null = null
    const saveFn = vi.fn().mockImplementation(() => {
      if (saveFn.mock.calls.length === 1) {
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve(undefined)
    })

    const { rerender } = renderHook(
      ({ value }) => useAutosave(value, saveFn, 100),
      { initialProps: { value: { count: 0 } } }
    )

    // First edit fires save(1), left unresolved (simulating a slow request).
    act(() => { rerender({ value: { count: 1 } }) })
    act(() => { vi.advanceTimersByTime(100) })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenNthCalledWith(1, { count: 1 })

    // A second edit's debounce elapses while save(1) is still in flight.
    act(() => { rerender({ value: { count: 2 } }) })
    act(() => { vi.advanceTimersByTime(100) })

    // Must not fire a second, concurrent save yet - only queue it.
    expect(saveFn).toHaveBeenCalledTimes(1)

    // Once save(1) settles, the queued latest value goes out - and only that one.
    await act(async () => { resolveFirst?.() })
    await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(2))
    expect(saveFn).toHaveBeenNthCalledWith(2, { count: 2 })
  })

  describe('flushOnUnmount', () => {
    it('flushes a still-pending save on unmount instead of dropping it', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      const { rerender, unmount } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 800, { flushOnUnmount: true }),
        { initialProps: { value: { count: 0 } } }
      )

      act(() => {
        rerender({ value: { count: 1 } })
      })
      // Still inside the 800ms debounce window: nothing sent yet.
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(saveFn).not.toHaveBeenCalled()

      unmount()
      expect(saveFn).toHaveBeenCalledTimes(1)
      expect(saveFn).toHaveBeenCalledWith({ count: 1 })
    })

    it('does not flush on unmount when the option is off (the default)', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      const { rerender, unmount } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 800),
        { initialProps: { value: { count: 0 } } }
      )

      act(() => {
        rerender({ value: { count: 1 } })
      })
      unmount()
      expect(saveFn).not.toHaveBeenCalled()
    })

    it('does nothing on unmount when there is no pending save', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      const { unmount } = renderHook(() => useAutosave({ count: 0 }, saveFn, 800, { flushOnUnmount: true }))
      unmount()
      expect(saveFn).not.toHaveBeenCalled()
    })
  })

  /**
   * Root-cause regression for "created a template, refreshed, content
   * gone": a hard refresh/tab close never runs React's unmount cleanup, so
   * `flushOnUnmount` (a real save awaited inside that cleanup) cannot help.
   * `onUnload` is the separate, synchronous path for that case.
   */
  describe('onUnload', () => {
    it('calls onUnload with the latest value on beforeunload when a save is still pending', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      const onUnload = vi.fn()
      const { rerender } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 800, { onUnload }),
        { initialProps: { value: { count: 0 } } }
      )

      act(() => {
        rerender({ value: { count: 1 } })
      })
      // Still inside the 800ms debounce window: nothing sent yet.
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(saveFn).not.toHaveBeenCalled()

      window.dispatchEvent(new Event('beforeunload'))
      expect(onUnload).toHaveBeenCalledTimes(1)
      expect(onUnload).toHaveBeenCalledWith({ count: 1 })
    })

    it('does not call onUnload once the value has already been sent', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      const onUnload = vi.fn()
      const { rerender } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 100, { onUnload }),
        { initialProps: { value: { count: 0 } } }
      )

      act(() => {
        rerender({ value: { count: 1 } })
      })
      act(() => {
        vi.advanceTimersByTime(100)
      })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(1))

      window.dispatchEvent(new Event('beforeunload'))
      expect(onUnload).not.toHaveBeenCalled()
    })

    it('does nothing on beforeunload when the option is not set (the default)', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      const { rerender } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 800),
        { initialProps: { value: { count: 0 } } }
      )

      act(() => {
        rerender({ value: { count: 1 } })
      })
      // No listener should throw or otherwise misbehave with nothing wired up.
      expect(() => window.dispatchEvent(new Event('beforeunload'))).not.toThrow()
    })
  })
  /**
   * Root-cause regression for "lost on refresh" (2026-09-20): `runSave`
   * used to mark a value "sent" *before* awaiting `save`, so a failed
   * attempt still counted as sent and the beforeunload beacon skipped it.
   * A refresh after any failed save lost the edit with no beacon at all.
   */
  describe('after a failed save', () => {
    it('still calls onUnload on beforeunload, because the value never reached the server', async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error('503'))
      const onUnload = vi.fn()
      const { rerender } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 100, { onUnload }),
        { initialProps: { value: { count: 0 } } }
      )
      act(() => { rerender({ value: { count: 1 } }) })
      act(() => { vi.advanceTimersByTime(100) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(1))

      window.dispatchEvent(new Event('beforeunload'))
      expect(onUnload).toHaveBeenCalledWith({ count: 1 })
    })

    it('flushes the unsaved value on unmount even though no debounce timer is pending', async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error('503'))
      const { rerender, unmount } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 100, { flushOnUnmount: true }),
        { initialProps: { value: { count: 0 } } }
      )
      act(() => { rerender({ value: { count: 1 } }) })
      act(() => { vi.advanceTimersByTime(100) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(1))

      unmount()
      expect(saveFn).toHaveBeenCalledTimes(2)
      expect(saveFn).toHaveBeenNthCalledWith(2, { count: 1 })
    })

    it('retries on its own after a backoff delay, without another edit', async () => {
      let calls = 0
      const saveFn = vi.fn().mockImplementation(() => {
        calls += 1
        return calls === 1 ? Promise.reject(new Error('503')) : Promise.resolve(undefined)
      })
      const { rerender, result } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 100),
        { initialProps: { value: { count: 0 } } }
      )
      act(() => { rerender({ value: { count: 1 } }) })
      act(() => { vi.advanceTimersByTime(100) })
      await vi.waitFor(() => expect(result.current.status).toBe('error'))

      // First backoff step is 1s.
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(2))
      expect(saveFn).toHaveBeenNthCalledWith(2, { count: 1 })
      await vi.waitFor(() => expect(result.current.status).toBe('saved'))
    })

    it('doubles the backoff on each consecutive failure', async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error('503'))
      const { rerender } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 100),
        { initialProps: { value: { count: 0 } } }
      )
      act(() => { rerender({ value: { count: 1 } }) })
      act(() => { vi.advanceTimersByTime(100) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(1))

      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(2))

      // Second retry waits 2s: 1s in is too early.
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(saveFn).toHaveBeenCalledTimes(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(3))
    })

    it('marks the event so the browser prompts before unloading unsynced content', async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error('503'))
      const { rerender } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 100, { promptOnUnload: true }),
        { initialProps: { value: { count: 0 } } }
      )
      act(() => { rerender({ value: { count: 1 } }) })
      act(() => { vi.advanceTimersByTime(100) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(1))

      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('does not prompt on unload once everything is saved', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      const { rerender } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 100, { promptOnUnload: true }),
        { initialProps: { value: { count: 0 } } }
      )
      act(() => { rerender({ value: { count: 1 } }) })
      act(() => { vi.advanceTimersByTime(100) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(1))
      await act(async () => {})

      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('conflict', () => {
    it('reports a conflict and does not auto-retry when save throws AutosaveConflictError', async () => {
      const saveFn = vi.fn().mockRejectedValue(new AutosaveConflictError())
      const { rerender, result } = renderHook(
        ({ value }) => useAutosave(value, saveFn, 100),
        { initialProps: { value: { count: 0 } } }
      )
      act(() => { rerender({ value: { count: 1 } }) })
      act(() => { vi.advanceTimersByTime(100) })
      await vi.waitFor(() => expect(result.current.status).toBe('conflict'))

      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(saveFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('saveInitial', () => {
    it('saves the very first value when the option is set, instead of treating it as already stored', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      renderHook(() => useAutosave({ count: 0 }, saveFn, 100, { saveInitial: true }))
      act(() => { vi.advanceTimersByTime(100) })
      expect(saveFn).toHaveBeenCalledWith({ count: 0 })
    })

    /**
     * Dev-only StrictMode mounts, unmounts and remounts every effect. The
     * unmount cleanup cancelled the initial save's timer and the remount
     * saw "same value, nothing to do", so a restored draft never saved in
     * development (live-check finding, 2026-09-20). The same fake unmount
     * also flipped the hook's "unmounted" flag for good, disabling every
     * automatic retry for the rest of the session.
     */
    it('still saves the first value, and still auto-retries, under StrictMode double-mounting', async () => {
      let calls = 0
      const saveFn = vi.fn().mockImplementation(() => {
        calls += 1
        return calls === 1 ? Promise.reject(new Error('503')) : Promise.resolve(undefined)
      })
      const { result } = renderHook(() => useAutosave({ count: 0 }, saveFn, 100, { saveInitial: true }), { wrapper: StrictMode })
      act(() => { vi.advanceTimersByTime(100) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(1))
      await vi.waitFor(() => expect(result.current.status).toBe('error'))
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(2))
      await vi.waitFor(() => expect(result.current.status).toBe('saved'))
    })

    it('skips the first value by default', () => {
      const saveFn = vi.fn().mockResolvedValue(undefined)
      renderHook(() => useAutosave({ count: 0 }, saveFn, 100))
      act(() => { vi.advanceTimersByTime(100) })
      expect(saveFn).not.toHaveBeenCalled()
    })
  })
})
