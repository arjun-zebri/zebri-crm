/**
 * Unit tests for Website form (`lead`) surface readiness: a valid form needs at
 * least one field, exactly one submit, and a Name field.
 *
 * @module tests/unit/lib/branding/readiness-lead
 */
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { evaluateSurface } from '@/lib/branding/readiness'

const account = {
  stripeConnected: false,
  bankDetailsFilled: false,
  contractTemplateExists: false,
}

const field = (role: 'name' | 'email'): Block =>
  ({
    id: `f-${role}`,
    type: 'formField',
    role,
    inputType: 'text',
    label: role,
    required: false,
  } as Block)

const submit: Block = {
  id: 's',
  type: 'formSubmit',
  label: 'Go',
  successMessage: 'ok',
} as Block

describe('lead readiness', () => {
  it('is ready with a name field + submit', () => {
    expect(evaluateSurface('lead', [field('name'), submit], account).ready).toBe(true)
  })

  it('is not ready without a submit', () => {
    const r = evaluateSurface('lead', [field('name')], account)
    expect(r.ready).toBe(false)
    expect(r.issues.some((i) => i.kind === 'need-exactly-one')).toBe(true)
  })

  it('is not ready without any field', () => {
    const r = evaluateSurface('lead', [submit], account)
    expect(r.ready).toBe(false)
    expect(r.issues.some((i) => i.kind === 'need-at-least-one')).toBe(true)
  })

  it('is not ready without a name field', () => {
    const r = evaluateSurface('lead', [field('email'), submit], account)
    expect(r.ready).toBe(false)
    expect(r.issues.some((i) => i.kind === 'need-name-field')).toBe(true)
  })
})
