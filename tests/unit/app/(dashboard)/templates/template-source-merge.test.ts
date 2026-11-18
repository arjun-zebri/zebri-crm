/**
 * "Add from package" into an invoice template.
 *
 * Regression: pulling a single-price package into a template copied its
 * inclusions as $0 lines and dropped the package price, so the template
 * totalled $0 and the MC had to re-price every line by hand. Every case
 * below must move the template total by exactly the package's base price.
 */
import { describe, expect, it } from 'vitest'

import {
  mergeSourceIntoTemplate,
  type TemplatePricingDraft,
  type TemplateSource,
} from '@/app/(dashboard)/templates/template-source-merge'

const gold: TemplateSource = {
  id: 'p1',
  kind: 'package',
  name: 'Gold',
  pricingMode: 'single',
  fixedPrice: 2400,
  items: [
    { description: 'Two Zoom calls', amount: 0 },
    { description: 'Run sheet', amount: 0 },
  ],
}

const itemised: TemplateSource = {
  id: 'p2',
  kind: 'package',
  name: 'Ceremony',
  pricingMode: 'itemised',
  fixedPrice: null,
  items: [
    { description: 'Ceremony hosting', amount: 550 },
    { description: '2 × Microphone', amount: 100 },
  ],
}

const empty: TemplatePricingDraft = { items: [], singlePrice: false, fixedPrice: '' }

const line = (description: string, amount: number) => ({ id: description, description, amount, quantity: 1, note: null })

describe('mergeSourceIntoTemplate', () => {
  it('turns an empty template single-price and carries the package price', () => {
    const next = mergeSourceIntoTemplate(empty, gold)
    expect(next.singlePrice).toBe(true)
    expect(next.fixedPrice).toBe('2400')
    expect(next.items.map((i) => i.description)).toEqual(['Two Zoom calls', 'Run sheet'])
  })

  it('ignores a blank starter row when deciding the template is empty', () => {
    const next = mergeSourceIntoTemplate({ ...empty, items: [line('', 0)] }, gold)
    expect(next.singlePrice).toBe(true)
    expect(next.items).toHaveLength(2)
  })

  it('adds a single-price package to a single-price template', () => {
    const next = mergeSourceIntoTemplate({ items: [line('Rehearsal', 0)], singlePrice: true, fixedPrice: '300' }, gold)
    expect(next.fixedPrice).toBe('2700')
    expect(next.items).toHaveLength(3)
  })

  it('appends one priced line when the template is already itemised', () => {
    const next = mergeSourceIntoTemplate({ items: [line('Travel', 120)], singlePrice: false, fixedPrice: '' }, gold)
    expect(next.singlePrice).toBe(false)
    expect(next.items[1]).toMatchObject({ description: 'Gold', note: 'Two Zoom calls\nRun sheet', amount: 2400 })
  })

  it('adds an itemised package to a single-price template as inclusions plus its total', () => {
    const next = mergeSourceIntoTemplate({ items: [], singlePrice: true, fixedPrice: '1000' }, itemised)
    expect(next.fixedPrice).toBe('1650')
    expect(next.items.every((i) => i.amount === 0)).toBe(true)
  })

  it('appends priced lines when both sides are itemised', () => {
    const next = mergeSourceIntoTemplate(empty, itemised)
    expect(next.singlePrice).toBe(false)
    expect(next.items.map((i) => i.amount)).toEqual([550, 100])
  })
})
