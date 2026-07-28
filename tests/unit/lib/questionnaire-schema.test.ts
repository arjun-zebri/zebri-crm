/**
 * Unit tests for the questionnaire question/response schemas and the pure
 * builder helpers. These guard the shared contract every surface depends on:
 * validation shape, required-answer detection, and list editing.
 */
import { describe, expect, it } from 'vitest'

import {
  addQuestion,
  createQuestion,
  moveQuestion,
  removeQuestion,
  updateQuestion,
} from '@/lib/questionnaires/builder-state'
import {
  missingRequiredAnswers,
  questionSchema,
  questionsSchema,
  responsesSchema,
  type Question,
} from '@/lib/questionnaires/question-schema'

const q = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  type: 'short_text',
  label: 'Name',
  required: false,
  ...over,
})

describe('questionSchema', () => {
  it('accepts a valid question and defaults required to false', () => {
    const parsed = questionSchema.parse({ id: 'a', type: 'short_text', label: 'Hi' })
    expect(parsed.required).toBe(false)
  })

  it('rejects an empty label', () => {
    expect(questionSchema.safeParse({ id: 'a', type: 'short_text', label: '' }).success).toBe(false)
  })

  it('rejects an unknown type', () => {
    expect(questionSchema.safeParse({ id: 'a', type: 'rating', label: 'Hi' }).success).toBe(false)
  })

  it('validates a list of questions', () => {
    expect(questionsSchema.safeParse([q(), q({ id: 'q2' })]).success).toBe(true)
  })
})

describe('responsesSchema', () => {
  it('accepts strings, numbers, and string arrays keyed by id', () => {
    const r = responsesSchema.parse({ q1: 'yes', q2: 3, q3: ['a', 'b'] })
    expect(r.q2).toBe(3)
    expect(r.q3).toEqual(['a', 'b'])
  })
})

describe('missingRequiredAnswers', () => {
  it('flags required input questions with no answer', () => {
    const questions = [q({ id: 'q1', required: true }), q({ id: 'q2', required: false })]
    expect(missingRequiredAnswers(questions, {})).toEqual(['q1'])
  })

  it('treats blank strings and empty arrays as unanswered but 0 as answered', () => {
    const questions = [
      q({ id: 'blank', required: true }),
      q({ id: 'list', type: 'multiple_choice', required: true, options: ['a'] }),
      q({ id: 'num', type: 'number', required: true }),
    ]
    expect(missingRequiredAnswers(questions, { blank: '  ', list: [], num: 0 })).toEqual(['blank', 'list'])
  })

  it('ignores section headings even if asked to be required', () => {
    const questions = [q({ id: 's', type: 'section', required: true })]
    expect(missingRequiredAnswers(questions, {})).toEqual([])
  })
})

describe('builder-state helpers', () => {
  it('createQuestion seeds two options for choice types only', () => {
    expect(createQuestion('single_choice', 'x').options).toEqual(['', ''])
    expect(createQuestion('short_text', 'y').options).toBeUndefined()
  })

  it('add/update/remove are immutable and targeted', () => {
    const start = [q({ id: 'a' })]
    const added = addQuestion(start, q({ id: 'b' }))
    expect(added).toHaveLength(2)
    expect(start).toHaveLength(1) // unchanged

    const updated = updateQuestion(added, 'b', { label: 'Changed' })
    expect(updated.find((x) => x.id === 'b')?.label).toBe('Changed')
    expect(updated.find((x) => x.id === 'a')?.label).toBe('Name')

    expect(removeQuestion(updated, 'a').map((x) => x.id)).toEqual(['b'])
  })

  it('moveQuestion reorders and no-ops on unknown ids', () => {
    const list = [q({ id: 'a' }), q({ id: 'b' }), q({ id: 'c' })]
    expect(moveQuestion(list, 'a', 'c').map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(moveQuestion(list, 'a', 'zzz')).toBe(list)
  })
})
