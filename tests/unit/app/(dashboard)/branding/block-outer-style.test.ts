import { describe, expect, it } from 'vitest'

import { blockOuterStyle, hasOuterStyle } from '@/lib/branding/block-outer-style'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

describe('blockOuterStyle', () => {
  it('returns empty object for block with no outer style fields', () => {
    const block: Block = { id: 'test', type: 'text', text: '' }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style).toEqual({})
  })

  it('includes paddingTop when padTop is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', padTop: 10 }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.paddingTop).toBe(10)
  })

  it('includes all padding sides when set', () => {
    const block: Block = {
      id: 'test',
      type: 'text',
      text: '',
      padTop: 10,
      padRight: 20,
      padBottom: 30,
      padLeft: 40,
    }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.paddingTop).toBe(10)
    expect(style.paddingRight).toBe(20)
    expect(style.paddingBottom).toBe(30)
    expect(style.paddingLeft).toBe(40)
  })

  it('includes background color when bgColor is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', bgColor: '#FFFFFF' }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.background).toBe('#FFFFFF')
  })

  it('includes border properties when borderWidth is set', () => {
    const block: Block = {
      id: 'test',
      type: 'text',
      text: '',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.borderWidth).toBe(1)
    expect(style.borderColor).toBe('#E5E7EB')
    expect(style.borderStyle).toBe('solid')
  })

  it('includes borderRadius when borderWidth or blockRadius is set', () => {
    const block: Block = {
      id: 'test',
      type: 'text',
      text: '',
      borderWidth: 1,
      blockRadius: 8,
    }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.borderRadius).toBe(8)
  })

  it('uses global cornerRadius when a border exists but no blockRadius is set', () => {
    const block: Block = {
      id: 'test',
      type: 'text',
      text: '',
      borderWidth: 1,
    }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.borderRadius).toBe(12)
  })

  it('does not include borderRadius when no border and no blockRadius', () => {
    const block: Block = { id: 'test', type: 'text', text: '' }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.borderRadius).toBeUndefined()
  })

  it('includes maxWidth when maxWidthPx is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', maxWidthPx: 600 }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.maxWidth).toBe(600)
  })

  it('includes alignment via marginInline when align is center', () => {
    const block: Block = { id: 'test', type: 'text', text: '', align: 'center' }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.marginInline).toBe('auto')
  })

  it('includes marginLeft auto when align is right', () => {
    const block: Block = { id: 'test', type: 'text', text: '', align: 'right' }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.marginLeft).toBe('auto')
  })

  it('includes marginTop and marginBottom for spacing', () => {
    const block: Block = {
      id: 'test',
      type: 'text',
      text: '',
      spaceAbove: 16,
      spaceBelow: 24,
    }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.marginTop).toBe(16)
    expect(style.marginBottom).toBe(24)
  })

  it('does not include undefined-valued keys', () => {
    const block: Block = {
      id: 'test',
      type: 'text',
      text: '',
      padTop: 10,
    }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    const keys = Object.keys(style)
    expect(keys).toContain('paddingTop')
    expect(keys.every((k) => (style as Record<string, unknown>)[k] !== undefined)).toBe(true)
  })

  it('combines padding, background, border and alignment', () => {
    const block: Block = {
      id: 'test',
      type: 'text',
      text: '',
      padTop: 10,
      bgColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      blockRadius: 8,
      align: 'center',
      maxWidthPx: 500,
      spaceAbove: 20,
    }
    const style = blockOuterStyle(block, { cornerRadius: 12 })
    expect(style.paddingTop).toBe(10)
    expect(style.background).toBe('#F3F4F6')
    expect(style.borderWidth).toBe(1)
    expect(style.borderRadius).toBe(8)
    expect(style.marginInline).toBe('auto')
    expect(style.maxWidth).toBe(500)
    expect(style.marginTop).toBe(20)
  })
})

describe('hasOuterStyle', () => {
  it('returns false for block with no outer style fields', () => {
    const block: Block = { id: 'test', type: 'text', text: '' }
    expect(hasOuterStyle(block)).toBe(false)
  })

  it('returns true when padTop is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', padTop: 10 }
    expect(hasOuterStyle(block)).toBe(true)
  })

  it('returns true when bgColor is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', bgColor: '#FFF' }
    expect(hasOuterStyle(block)).toBe(true)
  })

  it('returns true when borderWidth is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', borderWidth: 1 }
    expect(hasOuterStyle(block)).toBe(true)
  })

  it('returns true when blockRadius is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', blockRadius: 8 }
    expect(hasOuterStyle(block)).toBe(true)
  })

  it('returns true when maxWidthPx is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', maxWidthPx: 600 }
    expect(hasOuterStyle(block)).toBe(true)
  })

  it('returns true when align is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', align: 'center' }
    expect(hasOuterStyle(block)).toBe(true)
  })

  it('returns true when spaceAbove is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', spaceAbove: 16 }
    expect(hasOuterStyle(block)).toBe(true)
  })

  it('returns true when spaceBelow is set', () => {
    const block: Block = { id: 'test', type: 'text', text: '', spaceBelow: 16 }
    expect(hasOuterStyle(block)).toBe(true)
  })
})
