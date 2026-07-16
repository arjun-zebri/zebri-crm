/**
 * Unit tests for useAutosave hook with retry functionality.
 * Tests autosave debouncing, error handling, and manual retry.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useAutosave } from '@/lib/branding/use-autosave'

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
})
