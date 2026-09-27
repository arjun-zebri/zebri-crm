/**
 * Unit coverage for `logAutomatedSend` (Task 30): the row it writes, the
 * replayed-send case that must stay silent, and the log-failure alert
 * that must never throw and fires once per tenant per window. The real
 * insert, RLS and webhook advancement run in
 * `tests/integration/email/automated-send-log.test.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn(async () => undefined) }))

import { sendAlert } from '@/lib/alerts'
import {
  _resetSendLogAlertDedupForTest,
  logAutomatedSend,
  transportOf,
  type AutomatedSendLogEntry,
} from '@/lib/email/send-log'
import type { Database } from '@/types/database'

/** A client whose `log_automated_send` call resolves to `outcome`, recording the args. */
function fakeClient(outcome: { error: { code?: string; message: string } | null } | 'throw') {
  const rpc = vi.fn(async (fn: string, args: unknown) => {
    void fn
    void args
    if (outcome === 'throw') throw new Error('network down')
    return outcome
  })
  const client = { rpc } as unknown as SupabaseClient<Database>
  return { client, rpc }
}

function entry(overrides: Partial<AutomatedSendLogEntry> = {}): AutomatedSendLogEntry {
  return {
    userId: 'user-1',
    coupleId: 'couple-1',
    stepId: 'step-1',
    instanceId: 'instance-1',
    to: 'sam@example.com',
    subject: 'Your timeline',
    transport: 'resend',
    attemptKey: 'step-1:sam@example.com:abc',
    result: { ok: true, messageId: 'msg-1' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(sendAlert).mockClear()
  _resetSendLogAlertDedupForTest()
})

describe('logAutomatedSend', () => {
  it('writes a sent row through log_automated_send with the provider id, attempt key and transport', async () => {
    const { client, rpc } = fakeClient({ error: null })
    await logAutomatedSend(client, entry())
    expect(rpc).toHaveBeenCalledWith('log_automated_send', {
      p_user_id: 'user-1',
      p_couple_id: 'couple-1',
      p_to_email: 'sam@example.com',
      p_subject: 'Your timeline',
      p_status: 'sent',
      p_transport: 'resend',
      p_step_id: 'step-1',
      p_instance_id: 'instance-1',
      p_provider_message_id: 'msg-1',
      p_attempt_key: 'step-1:sam@example.com:abc',
    })
    expect(sendAlert).not.toHaveBeenCalled()
  })

  it('writes a failed row with the error and no provider id', async () => {
    const { client, rpc } = fakeClient({ error: null })
    await logAutomatedSend(client, entry({ result: { ok: false, error: 'domain not verified' } }))
    const args = rpc.mock.calls[0]![1] as Record<string, unknown>
    expect(args).toMatchObject({ p_status: 'failed', p_error: 'domain not verified' })
    expect(args).not.toHaveProperty('p_provider_message_id')
  })

  it('alerts on a unique violation too: only a same-attempt-key conflict is "already logged", and that one is absorbed in SQL (M1)', async () => {
    const { client } = fakeClient({ error: { code: '23505', message: 'duplicate key' } })
    await logAutomatedSend(client, entry())
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'automated_send_log_failed', code: '23505' }))
  })

  it('alerts with ids only when the write fails, once per tenant per window', async () => {
    const { client } = fakeClient({ error: { code: '42501', message: 'permission denied' } })
    await logAutomatedSend(client, entry())
    await logAutomatedSend(client, entry({ stepId: 'step-2' }))
    expect(sendAlert).toHaveBeenCalledTimes(1)
    expect(sendAlert).toHaveBeenCalledWith({
      type: 'automated_send_log_failed',
      severity: 'error',
      userId: 'user-1',
      coupleId: 'couple-1',
      stepId: 'step-1',
      instanceId: 'instance-1',
      outcome: 'sent',
      code: '42501',
    })

    // Another tenant is not held back by the first one's dedup.
    await logAutomatedSend(client, entry({ userId: 'user-2' }))
    expect(sendAlert).toHaveBeenCalledTimes(2)
  })

  it('never throws when the client itself throws', async () => {
    const { client } = fakeClient('throw')
    await expect(logAutomatedSend(client, entry())).resolves.toBeUndefined()
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'automated_send_log_failed', code: null }))
  })
})

describe('transportOf', () => {
  it('maps the resolved sender to the stored transport', () => {
    expect(transportOf({ transport: 'resend', from: 'x' })).toBe('resend')
    expect(
      transportOf({ transport: 'oauth', from: 'x', oauth: { provider: 'google', accessToken: 't' } }),
    ).toBe('gmail')
    expect(
      transportOf({ transport: 'oauth', from: 'x', oauth: { provider: 'microsoft', accessToken: 't' } }),
    ).toBe('graph')
  })
})
