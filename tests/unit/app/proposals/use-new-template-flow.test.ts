/**
 * `useNewTemplateFlow`: the New template modal step machine (founder's
 * ask, UX audit §3.8-3.9) - choose -> (gallery ->) name, with a working
 * Back and a full reset on close.
 *
 * @module tests/unit/app/proposals/use-new-template-flow
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useNewTemplateFlow } from '@/app/(dashboard)/proposals/templates/use-new-template-flow'
import type { TemplateStarter } from '@/features/proposals'

const STARTER: TemplateStarter = {
  id: 'reception-mc', name: 'Reception MC', description: 'x', category: 'mc',
  build: () => ({ version: 2, sections: [] }),
}

describe('useNewTemplateFlow', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useNewTemplateFlow())
    expect(result.current.step).toBe('closed')
    expect(result.current.starter).toBeNull()
  })

  it('open() goes to choose; chooseScratch() skips the gallery straight to name with no starter', () => {
    const { result } = renderHook(() => useNewTemplateFlow())
    act(() => result.current.open())
    expect(result.current.step).toBe('choose')
    act(() => result.current.chooseScratch())
    expect(result.current.step).toBe('name')
    expect(result.current.starter).toBeNull()
  })

  it('chooseGallery() opens the gallery; confirmStarter() is a no-op with nothing selected', () => {
    const { result } = renderHook(() => useNewTemplateFlow())
    act(() => result.current.open())
    act(() => result.current.chooseGallery())
    expect(result.current.step).toBe('gallery')
    act(() => result.current.confirmStarter())
    expect(result.current.step).toBe('gallery')
  })

  it('selectStarter() then confirmStarter() carries the starter into the name step', () => {
    const { result } = renderHook(() => useNewTemplateFlow())
    act(() => result.current.open())
    act(() => result.current.chooseGallery())
    act(() => result.current.selectStarter(STARTER))
    expect(result.current.starter).toBe(STARTER)
    act(() => result.current.confirmStarter())
    expect(result.current.step).toBe('name')
    expect(result.current.starter).toBe(STARTER)
  })

  it('backToChoose() from the gallery returns to choose and clears any selection', () => {
    const { result } = renderHook(() => useNewTemplateFlow())
    act(() => result.current.open())
    act(() => result.current.chooseGallery())
    act(() => result.current.selectStarter(STARTER))
    act(() => result.current.backToChoose())
    expect(result.current.step).toBe('choose')
    expect(result.current.starter).toBeNull()
  })

  it('close() resets to closed with no starter from any step', () => {
    const { result } = renderHook(() => useNewTemplateFlow())
    act(() => result.current.open())
    act(() => result.current.chooseGallery())
    act(() => result.current.selectStarter(STARTER))
    act(() => result.current.confirmStarter())
    act(() => result.current.close())
    expect(result.current.step).toBe('closed')
    expect(result.current.starter).toBeNull()
  })
})
