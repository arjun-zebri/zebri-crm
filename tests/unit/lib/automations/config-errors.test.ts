/**
 * Run-error formatting tests.
 *
 * The couple profile renders `automation_runs.error_message`
 * verbatim, so these lock in two behaviours: the runner writes plain
 * English for config failures, and the UI rewrites legacy rows that
 * still contain raw Zod JSON.
 */
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  configErrorMessage,
  describeConfigError,
  friendlyRunError,
} from '@/lib/automations/config-errors'

const emailConfig = z.object({
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
})

function failParse(input: unknown): z.ZodError {
  const result = emailConfig.safeParse(input)
  if (result.success) throw new Error('expected parse to fail')
  return result.error
}

describe('describeConfigError', () => {
  it('phrases an empty string as a requirement, not a type error', () => {
    expect(describeConfigError(failParse({ subject: '', bodyHtml: 'hi' }))).toBe(
      'Subject is required',
    )
  })

  it('phrases a missing field as a requirement', () => {
    expect(describeConfigError(failParse({ subject: 'hello' }))).toBe('Body html is required')
  })

  it('joins multiple issues', () => {
    expect(describeConfigError(failParse({}))).toBe('Subject is required; Body html is required')
  })

  it('humanises snake_case paths', () => {
    const schema = z.object({ task_title: z.string().min(1) })
    const result = schema.safeParse({ task_title: '' })
    if (result.success) throw new Error('expected parse to fail')
    expect(describeConfigError(result.error)).toBe('Task title is required')
  })

  it('falls back to the Zod message for non-blank issues', () => {
    const schema = z.object({ days: z.number().max(30) })
    const result = schema.safeParse({ days: 99 })
    if (result.success) throw new Error('expected parse to fail')
    expect(describeConfigError(result.error)).toMatch(/^Days: /)
  })
})

describe('configErrorMessage', () => {
  it('names the step and tells the MC where to fix it', () => {
    expect(configErrorMessage('Send email', failParse({ subject: '', bodyHtml: 'hi' }))).toBe(
      'The "Send email" step has invalid settings: Subject is required. Edit the automation to fix it.',
    )
  })
})

describe('friendlyRunError', () => {
  it('rewrites legacy raw-Zod messages', () => {
    const legacy = `invalid config: ${failParse({ subject: '', bodyHtml: 'hi' }).message}`
    expect(friendlyRunError(legacy)).toBe(
      'This automation has a step with invalid settings: Subject is required. Edit the automation to fix it.',
    )
  })

  it('rewrites legacy built-in-action messages', () => {
    const legacy = `wait action config invalid: ${failParse({}).message}`
    expect(friendlyRunError(legacy)).toBe(
      'This automation has a step with invalid settings: Subject is required; Body html is required. Edit the automation to fix it.',
    )
  })

  it('rewrites unknown-action and internal-state messages', () => {
    expect(friendlyRunError('unknown action send_fax')).toMatch(/is not available yet/)
    expect(friendlyRunError('triggering event missing')).toMatch(/internal error/)
    expect(friendlyRunError('current_action_id points at missing action')).toMatch(
      /internal error/,
    )
  })

  it('passes already-friendly messages through unchanged', () => {
    const friendly =
      'The "Send email" step has invalid settings: Subject is required. Edit the automation to fix it.'
    expect(friendlyRunError(friendly)).toBe(friendly)
    expect(friendlyRunError('Email failed to send: recipient bounced')).toBe(
      'Email failed to send: recipient bounced',
    )
  })
})
