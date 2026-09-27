/**
 * `generate_run_sheet_pdf` mails the couple (through the gate) and the MC
 * (a plain copy to themselves). Emailing is best-effort there, so the
 * step stays done either way, but a copy that failed now shows up as the
 * partial-send warning with its counts and raises the alert (Task 31,
 * audit M6), rather than hiding behind `emailed: true`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const partialAlertMock = vi.fn<(input: unknown) => Promise<void>>(async () => undefined)
vi.mock('@/lib/email/partial-send-alert', () => ({
  alertPartialSendFailure: (input: unknown) => partialAlertMock(input),
}))

const gateSendMock = vi.fn()
// The gate is replaced (its checks have their own coverage); the rest of
// the module stays real for the other actions the registry loads.
vi.mock('@/lib/email/automation-send', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/automation-send')>()),
  openAutomationSend: async () => ({ kind: 'open', skipped: () => undefined, send: gateSendMock }),
}))

const dispatchMock = vi.fn()
vi.mock('@/lib/email/dispatch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/dispatch')>()),
  dispatchEmail: (...args: unknown[]) => dispatchMock(...args),
}))

vi.mock('@/lib/email/sender-identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/sender-identity')>()),
  resolveSender: async () => ({ transport: 'resend', from: 'Zebri <noreply@app.zebri.com.au>' }),
}))

vi.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {}
  chain['select'] = () => chain
  chain['eq'] = () => chain
  chain['maybeSingle'] = async () => ({
    data: { id: 'event-1', share_token: 'ev-tok', share_token_enabled: true },
    error: null,
  })
  return { createAdminClient: () => ({ from: () => chain }) }
})

function makeCtx(): RunContext {
  return {
    userId: 'u1',
    automationId: 'a1',
    runId: 'r1',
    instanceId: 'inst-1',
    stepId: 'step-7',
    coupleId: 'c1',
    triggerEvent: {
      id: 'evt',
      user_id: 'u1',
      source_table: 'couples',
      source_id: 'c1',
      event_type: 'new_enquiry',
      payload: {},
      couple_id: 'c1',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'c1',
      name: 'Sarah & Jake',
      email: 'sarah@example.com',
      phone: null,
      eventDate: null,
      venue: null,
      status: 'booked',
      primaryName: 'Sarah',
      spouseName: null,
      spouseEmail: null,
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    invoice: null,
    mc: {
      userId: 'u1',
      businessName: 'MC Business',
      contactName: 'Alex MC',
      email: 'alex@mcbusiness.com',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: null,
    },
    actionResults: {},
  }
}

async function run() {
  const spec = getActionSpec('generate_run_sheet_pdf')!
  const parsed = spec.configSchema.safeParse({ eventId: '6f1c2f1e-3f8a-4c3e-9b52-7c8a1f0d2e11', sendToCouple: true })
  expect(parsed.success).toBe(true)
  return spec.handler(makeCtx(), parsed.data as never)
}

beforeEach(() => {
  partialAlertMock.mockClear()
  gateSendMock.mockReset()
  dispatchMock.mockReset()
})

describe('generate_run_sheet_pdf partial failure', () => {
  it('counts a failed couple copy and alerts, while the MC copy went', async () => {
    gateSendMock.mockResolvedValue({ ok: false, error: 'mailbox full', code: 'validation_error', recoverable: true })
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'm-1' })

    const result = await run()

    expect(result).toMatchObject({
      kind: 'ok',
      output: { emailed: true, sent: 1, failed: 1, last_error: 'mailbox full', last_error_code: 'validation_error' },
    })
    expect(partialAlertMock).toHaveBeenCalledWith({
      userId: 'u1',
      coupleId: 'c1',
      stepId: 'step-7',
      instanceId: 'inst-1',
      actionType: 'generate_run_sheet_pdf',
      sent: 1,
      failed: 1,
      code: 'validation_error',
    })
  })

  it('counts an Outlook success with no message id as sent, raising nothing (review I3)', async () => {
    // What the gate returns for a Graph send: ok, no id.
    gateSendMock.mockResolvedValue({ ok: true, recoverable: false })
    dispatchMock.mockResolvedValue({ ok: true })

    const result = await run()

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.output).not.toHaveProperty('failed')
    expect(partialAlertMock).not.toHaveBeenCalled()
  })

  it('reports no failure and raises nothing when both copies went', async () => {
    gateSendMock.mockResolvedValue({ ok: true, messageId: 'm-c', recoverable: true })
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'm-1' })

    const result = await run()

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.output).not.toHaveProperty('failed')
    expect(partialAlertMock).not.toHaveBeenCalled()
  })
})
