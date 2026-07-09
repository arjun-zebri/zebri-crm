/**
 * Unit tests for the questionnaires v2 additions: display modes, the new
 * question types, the duplicate/validate builder helpers, flow-step building,
 * and the printable answers document.
 */
import { describe, expect, it } from 'vitest'

import { answersPrintHtml, formatAnswer } from '@/lib/questionnaires/answers-html'
import { duplicateQuestion, questionIssues } from '@/lib/questionnaires/builder-state'
import { buildSteps } from '@/lib/questionnaires/flow-steps'
import {
  DISPLAY_MODES,
  questionSchema,
  toDisplayMode,
  type Question,
} from '@/lib/questionnaires/question-schema'

const q = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  type: 'short_text',
  label: 'Name',
  required: false,
  ...over,
})

describe('display modes', () => {
  it('narrows untrusted values, defaulting to typeform', () => {
    expect(toDisplayMode('form')).toBe('form')
    expect(toDisplayMode('typeform')).toBe('typeform')
    expect(toDisplayMode('bogus')).toBe('typeform')
    expect(toDisplayMode(null)).toBe('typeform')
  })

  it('offers exactly the two modes in picker order', () => {
    expect(DISPLAY_MODES.map((m) => m.value)).toEqual(['typeform', 'form'])
  })
})

describe('new question types', () => {
  it('accepts dropdown, email, and phone questions', () => {
    expect(questionSchema.safeParse(q({ type: 'dropdown', options: ['A'] })).success).toBe(true)
    expect(questionSchema.safeParse(q({ type: 'email' })).success).toBe(true)
    expect(questionSchema.safeParse(q({ type: 'phone' })).success).toBe(true)
  })
})

describe('duplicateQuestion', () => {
  it('inserts the copy directly after the original with the new id', () => {
    const list = [q({ id: 'a' }), q({ id: 'b', type: 'single_choice', options: ['X', 'Y'] }), q({ id: 'c' })]
    const next = duplicateQuestion(list, 'b', 'b2')
    expect(next.map((x) => x.id)).toEqual(['a', 'b', 'b2', 'c'])
    expect(next[2]?.options).toEqual(['X', 'Y'])
    // The options array is cloned, not aliased.
    expect(next[2]?.options).not.toBe(next[1]?.options)
  })

  it('is a no-op for an unknown id', () => {
    const list = [q()]
    expect(duplicateQuestion(list, 'missing', 'x')).toBe(list)
  })
})

describe('questionIssues', () => {
  it('flags blank labels and optionless choice questions', () => {
    const issues = questionIssues([
      q({ id: 'ok' }),
      q({ id: 'blank', label: '  ' }),
      q({ id: 'choices', type: 'multiple_choice', options: ['', ' '] }),
      q({ id: 'dropdown-ok', type: 'dropdown', options: ['One'] }),
    ])
    expect(issues.map((i) => i.questionId)).toEqual(['blank', 'choices'])
  })

  it('returns empty for a saveable questionnaire', () => {
    expect(questionIssues([q(), q({ id: 'q2', type: 'yes_no' })])).toEqual([])
  })
})

describe('buildSteps', () => {
  it('attaches the closest preceding section to each answerable question', () => {
    const steps = buildSteps([
      q({ id: 's1', type: 'section', label: 'Basics' }),
      q({ id: 'a' }),
      q({ id: 's2', type: 'section', label: 'Ceremony' }),
      q({ id: 'b' }),
      q({ id: 'c' }),
    ])
    expect(steps.map((s) => [s.question.id, s.section])).toEqual([
      ['a', 'Basics'],
      ['b', 'Ceremony'],
      ['c', 'Ceremony'],
    ])
  })

  it('is null before any section and skips section rows themselves', () => {
    const steps = buildSteps([q({ id: 'a' }), q({ id: 's', type: 'section', label: 'Later' })])
    expect(steps).toHaveLength(1)
    expect(steps[0]?.section).toBeNull()
  })
})

describe('answersPrintHtml', () => {
  it('renders sections, answers, and a no-answer placeholder', () => {
    const html = answersPrintHtml({
      title: 'Ceremony details',
      coupleName: 'Sam & Alex',
      completedAt: '2026-07-01T00:00:00Z',
      questions: [q({ id: 's', type: 'section', label: 'Basics' }), q({ id: 'a', label: 'Venue?' }), q({ id: 'b', label: 'Song?' })],
      responses: { a: 'The Calile' },
    })
    expect(html).toContain('<h2>Basics</h2>')
    expect(html).toContain('Venue?')
    expect(html).toContain('The Calile')
    expect(html).toContain('No answer')
    expect(html).toContain('Completed 1 July 2026')
  })

  it('escapes HTML in labels and answers', () => {
    const html = answersPrintHtml({
      title: '<script>x</script>',
      coupleName: 'S&A',
      completedAt: null,
      questions: [q({ id: 'a', label: '<b>Q</b>' })],
      responses: { a: '<img src=x>' },
    })
    expect(html).not.toContain('<script>x')
    expect(html).not.toContain('<b>Q</b>')
    expect(html).not.toContain('<img src=x>')
    expect(html).toContain('&lt;img src=x&gt;')
  })

  it('formatAnswer joins arrays and stringifies numbers', () => {
    expect(formatAnswer(['a', 'b'])).toBe('a, b')
    expect(formatAnswer(3)).toBe('3')
    expect(formatAnswer(undefined)).toBe('')
  })
})
