import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { usePreviewScript } from '@/app/(dashboard)/onboarding/previews/use-preview-script'

describe('usePreviewScript', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('stays at beat 0 while inactive', () => {
    const { result } = renderHook(() =>
      usePreviewScript({ beats: 4, active: false, reducedMotion: false }),
    )
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current).toBe(0)
  })

  it('advances one beat at a time while active', () => {
    const { result } = renderHook(() =>
      usePreviewScript({ beats: 4, active: true, reducedMotion: false, beatMs: 1000 }),
    )
    expect(result.current).toBe(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(1)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current).toBe(3)
  })

  it('stops at the final beat', () => {
    const { result } = renderHook(() =>
      usePreviewScript({ beats: 3, active: true, reducedMotion: false, beatMs: 1000 }),
    )
    act(() => { vi.advanceTimersByTime(10000) })
    expect(result.current).toBe(2)
  })

  it('jumps straight to the final beat under reduced motion', () => {
    const { result } = renderHook(() =>
      usePreviewScript({ beats: 5, active: true, reducedMotion: true }),
    )
    expect(result.current).toBe(4)
  })

  it('replays from the start when reactivated', () => {
    const { result, rerender } = renderHook(
      ({ active }) => usePreviewScript({ beats: 4, active, reducedMotion: false, beatMs: 1000 }),
      { initialProps: { active: true } },
    )
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current).toBe(2)
    rerender({ active: false })
    expect(result.current).toBe(0)
    rerender({ active: true })
    expect(result.current).toBe(0)
  })
})
