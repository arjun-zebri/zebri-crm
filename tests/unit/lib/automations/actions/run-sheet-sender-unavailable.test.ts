/**
 * `generate_run_sheet_pdf` resolves its sender before it enables the
 * event's share token (Phase 5 residual pass, R3). A mailbox that cannot
 * be reached errors the step with nothing sent, and must not leave the
 * run-sheet link switched on for a send that never happened.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const dispatchMock = vi.fn()
vi.mock('@/lib/email/dispatch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/dispatch')>()),
  dispatchEmail: (...args: unknown[]) => dispatchMock(...args),
}))

vi.mock('@/lib/email/sender-identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/sender-identity')>()),
  resolveSenderForSend: async () => ({ status: 'unavailable', reason: 'token_refresh_failed' }),
}))

// Every write the handler makes, by table.
const updates = vi.hoisted(() => [] as Array<{ table: string; values: unknown }>)
vi.mock('@/lib/supabase/admin', () => {
  const tableChain = (table: string) => {
    const chain: Record<string, unknown> = {}
    chain['select'] = () => chain
    chain['eq'] = () => chain
    chain['maybeSingle'] = async () => ({
      data: { id: 'event-1', share_token: 'ev-tok', share_token_enabled: false },
      error: null,
    })
    chain['update'] = (values: unknown) => {
      updates.push({ table, values })
      return { eq: async () => ({ error: null }) }
    }
    return chain
  }
  return { createAdminClient: () => ({ from: (table: string) => tableChain(table) }) }
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

beforeEach(() => {
  updates.length = 0
  dispatchMock.mockReset()
})

describe('generate_run_sheet_pdf with an unreachable mailbox', () => {
  it('errors with nothing sent and leaves the share token untouched', async () => {
    const spec = getActionSpec('generate_run_sheet_pdf')!
    const parsed = spec.configSchema.safeParse({ eventId: '6f1c2f1e-3f8a-4c3e-9b52-7c8a1f0d2e11', sendToCouple: true })
    expect(parsed.success).toBe(true)

    const result = await spec.handler(makeCtx(), parsed.data as never)

    expect(result).toMatchObject({ kind: 'error', recoverable: false })
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(updates.filter((u) => u.table === 'events')).toEqual([])
  })
})
