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
  it('is ready with a name field + email field + submit', () => {
    expect(
      evaluateSurface('lead', [field('name'), field('email'), submit], account).ready,
    ).toBe(true)
  })

  it('is not ready without an email field, naming the "Email" question', () => {
    const r = evaluateSurface('lead', [field('name'), submit], account)
    expect(r.ready).toBe(false)
    const issue = r.issues.find((i) => i.kind === 'need-email-field')
    expect(issue).toBeDefined()
    expect(issue!.message).toContain('Email')
  })

  it('is not ready without a submit, with website-form copy (not questionnaire copy)', () => {
    const r = evaluateSurface('lead', [field('name'), field('email')], account)
    expect(r.ready).toBe(false)
    const issue = r.issues.find((i) => i.kind === 'need-exactly-one')
    expect(issue).toBeDefined()
    expect(issue!.message).toContain('Submit button')
    expect(issue!.message).not.toContain('form style')
  })

  it('is not ready without any field, with website-form copy (not invoice copy)', () => {
    const r = evaluateSurface('lead', [submit], account)
    expect(r.ready).toBe(false)
    const issue = r.issues.find((i) => i.kind === 'need-at-least-one')
    expect(issue).toBeDefined()
    expect(issue!.message).toContain('question')
    expect(issue!.message).not.toContain('Payment')
  })

  it('is not ready without a name field, naming the "Your name" question', () => {
    const r = evaluateSurface('lead', [field('email'), submit], account)
    expect(r.ready).toBe(false)
    const issue = r.issues.find((i) => i.kind === 'need-name-field')
    expect(issue).toBeDefined()
    expect(issue!.message).toContain('Your name')
  })

  it('is not ready without a name field', () => {
    const r = evaluateSurface('lead', [field('email'), submit], account)
    expect(r.ready).toBe(false)
    expect(r.issues.some((i) => i.kind === 'need-name-field')).toBe(true)
  })
})
