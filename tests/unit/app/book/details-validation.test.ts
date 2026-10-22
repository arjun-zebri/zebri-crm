/**
 * Details form validation: the checks mirror the server's, the phone modes,
 * the custom questions, and the order fields are focused in.
 *
 * @module tests/unit/app/book/details-validation
 */
import { describe, expect, it } from 'vitest'

import { groupQuestionRows } from '@/app/book/[token]/booking-question-field'
import {
  fieldOrder,
  firstInvalidField,
  validateDetails,
  type DetailsInput,
} from '@/app/book/[token]/details-validation'
import type { BookingQuestion } from '@/lib/booking/questions'

const valid: DetailsInput = {
  name: '  Alice Smith  ',
  email: ' alice@example.com ',
  phone: '',
  notes: '',
  answers: {},
}

const venue: BookingQuestion = {
  id: 'venue',
  label: 'Venue type',
  type: 'single_choice',
  required: true,
  options: ['Garden', 'Ballroom'],
}

describe('validateDetails', () => {
  it('trims the values and drops empty optionals', () => {
    const { errors, clean } = validateDetails(valid, [], 'optional')

    expect(errors).toEqual({})
    expect(clean).toEqual({
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: undefined,
      notes: undefined,
      answers: [],
    })
  })

  it('requires a name and an email', () => {
    const { errors, clean } = validateDetails({ ...valid, name: '   ', email: '' }, [], 'optional')

    expect(clean).toBeNull()
    expect(errors.name).toBe('Enter your name')
    expect(errors.email).toBe('Enter your email address')
  })

  it('rejects an email without a domain', () => {
    const { errors } = validateDetails({ ...valid, email: 'alice@example' }, [], 'optional')

    expect(errors.email).toMatch(/valid email address/)
  })

  it('requires a phone number only in the required mode', () => {
    expect(validateDetails(valid, [], 'required').errors.phone).toMatch(/phone number/)
    expect(validateDetails(valid, [], 'optional').errors.phone).toBeUndefined()
  })

  it('drops a typed phone number entirely when the field is hidden', () => {
    const { clean } = validateDetails({ ...valid, phone: '0412 345 678' }, [], 'hidden')

    expect(clean?.phone).toBeUndefined()
  })

  it('keeps a phone number when one is given in optional mode', () => {
    const { clean } = validateDetails({ ...valid, phone: ' +61 412 345 678 ' }, [], 'optional')

    expect(clean?.phone).toBe('+61 412 345 678')
  })

  it('blocks a required custom question and reports it by id', () => {
    const { errors, clean } = validateDetails(valid, [venue], 'optional')

    expect(clean).toBeNull()
    expect(errors.venue).toBe('Choose an option')
  })

  it('sends answers keyed to their question ids', () => {
    const { clean } = validateDetails({ ...valid, answers: { venue: 'Garden' } }, [venue], 'optional')

    expect(clean?.answers).toEqual([{ question_id: 'venue', value: 'Garden' }])
  })

  it('rejects a name over the server limit', () => {
    const { errors } = validateDetails({ ...valid, name: 'x'.repeat(121) }, [], 'optional')

    expect(errors.name).toMatch(/under 120/)
  })
})

describe('fieldOrder and firstInvalidField', () => {
  it('lists fields in the order they appear on the form', () => {
    expect(fieldOrder([venue], 'optional')).toEqual(['name', 'email', 'phone', 'venue', 'notes'])
    expect(fieldOrder([], 'hidden')).toEqual(['name', 'email', 'notes'])
  })

  it('picks the first invalid field in form order, not object order', () => {
    const order = fieldOrder([venue], 'optional')
    expect(firstInvalidField(order, { notes: 'x', venue: 'y', email: 'z' })).toBe('email')
  })

  it('ignores errors for fields the form does not render', () => {
    expect(firstInvalidField(['name'], { somethingElse: 'x' })).toBeUndefined()
  })
})

describe('groupQuestionRows', () => {
  const short = (id: string): BookingQuestion => ({ id, label: id, type: 'short_text', required: false })
  const para: BookingQuestion = { id: 'para', label: 'Story', type: 'long_text', required: false }

  it('pairs consecutive short questions side by side', () => {
    const rows = groupQuestionRows([short('a'), short('b'), short('c')])
    expect(rows.map((r) => r.map((q) => q.id))).toEqual([['a', 'b'], ['c']])
  })

  it('gives paragraphs and choices a full row', () => {
    const rows = groupQuestionRows([short('a'), para, short('b'), venue])
    expect(rows.map((r) => r.map((q) => q.id))).toEqual([['a'], ['para'], ['b'], ['venue']])
  })
})
