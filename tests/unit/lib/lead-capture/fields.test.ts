/**
 * Unit tests for the public field list + server-side required check.
 *
 * @module tests/unit/lib/lead-capture/fields
 */
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { FIXED_LEAD_FIELDS, leadFormFields, missingRequiredFields } from '@/lib/lead-capture/fields'

const field = (
  id: string,
  role: string,
  extra: Record<string, unknown> = {},
): Block =>
  ({ id, type: 'formField', role, inputType: 'text', label: `${role} label`, required: false, ...extra }) as Block

describe('leadFormFields', () => {
  it('returns the fixed set when there is no tree', () => {
    expect(leadFormFields(null)).toBe(FIXED_LEAD_FIELDS)
    expect(leadFormFields([])).toBe(FIXED_LEAD_FIELDS)
    expect(FIXED_LEAD_FIELDS.map((f) => f.key)).toEqual([
      'name', 'partner_name', 'email', 'phone', 'wedding_date', 'venue', 'referral_source', 'message',
    ])
    expect(FIXED_LEAD_FIELDS.filter((f) => f.required).map((f) => f.key)).toEqual(['name', 'email'])
  })

  it('maps formField blocks to public fields in order, skipping hidden and non-field blocks', () => {
    const fields = leadFormFields([
      { id: 'bn', type: 'businessName' } as Block,
      field('a', 'name', { required: false, placeholder: 'Jane' }),
      field('b', 'partnerName', { hidden: true }),
      field('c', 'custom', { label: 'Ceremony type', inputType: 'select', options: ['Civil', '', 'Religious'], required: true }),
      { id: 's', type: 'formSubmit', label: 'Send', successMessage: 'ok' } as Block,
    ])
    expect(fields).toEqual([
      { id: 'a', key: 'name', role: 'name', label: 'name label', required: true, inputType: 'text', placeholder: 'Jane', options: [] },
      { id: 'c', key: 'custom', role: 'custom', label: 'Ceremony type', required: true, inputType: 'select', placeholder: '', options: ['Civil', 'Religious'] },
    ])
  })

  it('never exposes anything but the eight public keys', () => {
    const [f] = leadFormFields([field('a', 'email', { locked: true, borderColor: '#000' })])
    expect(Object.keys(f!).sort()).toEqual(['id', 'inputType', 'key', 'label', 'options', 'placeholder', 'required', 'role'])
  })

  it('prepends the fixed name field when the tree has no name field at all', () => {
    const fields = leadFormFields([field('a', 'email', { required: true })])
    expect(fields[0]).toEqual(FIXED_LEAD_FIELDS[0])
    expect(fields.filter((f) => f.key === 'name')).toHaveLength(1)
  })

  it('prepends the fixed name field when the tree has a hidden name field', () => {
    const fields = leadFormFields([
      field('a', 'name', { hidden: true }),
      field('b', 'email', { required: true }),
    ])
    expect(fields[0]).toEqual(FIXED_LEAD_FIELDS[0])
    expect(fields.filter((f) => f.key === 'name')).toHaveLength(1)
  })
})

describe('missingRequiredFields', () => {
  const fields = leadFormFields([
    field('a', 'name', { required: true }),
    field('b', 'email', { required: true }),
    field('c', 'phone'),
    field('d', 'custom', { label: 'Ceremony type', required: true }),
  ])

  it('returns an empty map when everything required is present', () => {
    expect(
      missingRequiredFields(fields, {
        name: 'Jamie',
        email: 'j@example.test',
        custom: [{ label: ' ceremony TYPE ', value: 'Civil' }],
      }),
    ).toEqual({})
  })

  it('names each missing field by payload key, custom fields by label', () => {
    expect(missingRequiredFields(fields, { name: ' ', custom: [{ label: 'Ceremony type', value: '' }] })).toEqual({
      name: 'Required',
      email: 'Required',
      'custom.Ceremony type': 'Required',
    })
  })

  it('always requires name, even when the tree has no name field', () => {
    expect(missingRequiredFields(leadFormFields([field('b', 'email')]), { email: 'j@example.test' })).toEqual({
      name: 'Required',
    })
  })
})
