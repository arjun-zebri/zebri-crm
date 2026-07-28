import { describe, expect, it } from 'vitest'

import { cleanLineItems } from '@/lib/payments/line-item-draft'

describe('cleanLineItems', () => {
  it('drops fully empty rows and trims descriptions', () => {
    const { items, blankPriced } = cleanLineItems([
      { description: '  Reception MC ', amount: 900 },
      { description: '', amount: 0 },
      { description: '   ', amount: 0 },
    ])
    expect(items).toEqual([{ description: 'Reception MC', amount: 900 }])
    expect(blankPriced).toBe(0)
  })

  it('keeps free items that have a description', () => {
    const { items } = cleanLineItems([{ description: 'Planning meeting', amount: 0 }])
    expect(items).toEqual([{ description: 'Planning meeting', amount: 0 }])
  })

  it('flags priced rows with no description', () => {
    const { items, blankPriced } = cleanLineItems([{ description: ' ', amount: 500 }])
    expect(items).toHaveLength(1)
    expect(blankPriced).toBe(1)
  })

  it('preserves extra fields on kept rows', () => {
    const { items } = cleanLineItems([{ id: 'a', description: 'MC', amount: 100, quantity: 2 }])
    expect(items[0]).toEqual({ id: 'a', description: 'MC', amount: 100, quantity: 2 })
  })
})
