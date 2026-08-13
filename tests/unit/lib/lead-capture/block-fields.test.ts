/**
 * Unit tests for the Website form block-tree → submit-payload mapping.
 *
 * @module tests/unit/lib/lead-capture/block-fields
 */
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { buildLeadPayload, leadFieldBlocks, requiredFieldIds } from '@/lib/lead-capture/block-fields'

const field = (
  id: string,
  role: string,
  required = false,
): Block =>
  ({ id, type: 'formField', role, inputType: 'text', label: `${role}-label`, required } as Block)

const submit: Block = { id: 's', type: 'formSubmit', label: 'Send', successMessage: 'ok' } as Block

const tree: Block[] = [
  { id: 'bn', type: 'businessName' } as Block,
  field('f-name', 'name', true),
  field('f-email', 'email', true),
  field('f-date', 'weddingDate'),
  field('f-custom', 'custom'),
  submit,
]

describe('leadFieldBlocks', () => {
  it('returns only formField blocks in order', () => {
    expect(leadFieldBlocks(tree).map((b) => b.id)).toEqual(['f-name', 'f-email', 'f-date', 'f-custom'])
  })
})

describe('requiredFieldIds', () => {
  it('returns the ids of required fields', () => {
    expect(requiredFieldIds(tree)).toEqual(['f-name', 'f-email'])
  })
})

describe('buildLeadPayload', () => {
  it('maps known roles to canonical keys and custom to the bag', () => {
    const p = buildLeadPayload(tree, {
      'f-name': 'Jamie',
      'f-email': 'jamie@example.test',
      'f-date': '2027-05-01',
      'f-custom': '120 guests',
    })
    expect(p.name).toBe('Jamie')
    expect(p.email).toBe('jamie@example.test')
    expect(p.wedding_date).toBe('2027-05-01')
    expect(p.custom).toEqual([{ label: 'custom-label', value: '120 guests' }])
  })

  it('skips empty answers and trims values', () => {
    const p = buildLeadPayload(tree, { 'f-name': '  Sam  ', 'f-email': '', 'f-custom': '   ' })
    expect(p.name).toBe('Sam')
    expect(p.email).toBe('')
    expect(p.custom).toEqual([])
  })
})
