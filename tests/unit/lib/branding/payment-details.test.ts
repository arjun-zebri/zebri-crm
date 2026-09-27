/**
 * The client half of the payment-details lock (Task 23c): the key list,
 * the strip helper every `auth.updateUser` spread uses, the shape check
 * that mirrors the SQL, and the RPC call.
 */
import { describe, expect, it, vi } from 'vitest'

import { logger } from '@/lib/alerts/logger'
import {
  PAYMENT_DETAIL_KEYS,
  paymentDetailError,
  savePaymentDetails,
  withoutPaymentDetails,
} from '@/lib/branding/payment-details'

function mockClient(result: { data?: unknown; error?: { code: string; message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null })
  const refreshSession = vi.fn().mockResolvedValue({ data: {}, error: null })
  // Only the two members the helper touches.
  const client = { rpc, auth: { refreshSession } } as unknown as Parameters<typeof savePaymentDetails>[0]
  return { client, rpc, refreshSession }
}

describe('PAYMENT_DETAIL_KEYS', () => {
  it('lists exactly the keys the migration protects', () => {
    expect([...PAYMENT_DETAIL_KEYS]).toEqual(['bank_account_name', 'bank_bsb', 'bank_account_number', 'abn'])
  })
})

describe('withoutPaymentDetails', () => {
  it('drops the protected keys and keeps everything else', () => {
    const meta = {
      tagline: 'Hi',
      bank_account_name: 'A',
      bank_bsb: '062-000',
      bank_account_number: '1234',
      abn: '51 824 753 556',
    }
    expect(withoutPaymentDetails(meta)).toEqual({ tagline: 'Hi' })
    // A copy: the caller's object is untouched.
    expect(meta.bank_bsb).toBe('062-000')
  })

  it('accepts missing metadata', () => {
    expect(withoutPaymentDetails(undefined)).toEqual({})
    expect(withoutPaymentDetails(null)).toEqual({})
  })
})

describe('paymentDetailError', () => {
  it.each([
    ['bank_bsb', '062-000'],
    ['bank_bsb', '062000'],
    ['bank_bsb', '062 000'],
    ['bank_account_number', '1234'],
    ['bank_account_number', '12-345-678'],
    ['abn', '51 824 753 556'],
    ['abn', ''],
    ['bank_account_name', 'Jane Smith Events'],
  ] as const)('accepts %s %j', (key, value) => {
    expect(paymentDetailError(key, value)).toBeNull()
  })

  it.each([
    ['bank_bsb', '06200', 'BSB must be 6 digits'],
    ['bank_bsb', 'abcdef', 'BSB must be 6 digits'],
    ['bank_account_number', '123', 'Account number must be 4 to 10 digits'],
    ['bank_account_number', '12345678901', 'Account number must be 4 to 10 digits'],
    ['abn', '51 824 753', 'ABN must be 11 digits'],
    ['bank_account_name', 'x'.repeat(201), 'Account name must be 200 characters or fewer'],
  ] as const)('rejects %s %j', (key, value, message) => {
    expect(paymentDetailError(key, value)).toBe(message)
  })
})

describe('savePaymentDetails', () => {
  it('calls the RPC with exactly the patch, then refreshes the session', async () => {
    const values = { bank_account_name: 'A', bank_bsb: '083-004', bank_account_number: '1234', abn: null }
    const { client, rpc, refreshSession } = mockClient({ data: values })
    const result = await savePaymentDetails(client, { bank_bsb: '083-004' })
    expect(rpc).toHaveBeenCalledWith('set_my_payment_details', { p_details: { bank_bsb: '083-004' } })
    expect(refreshSession).toHaveBeenCalled()
    expect(result).toEqual({ ok: true, values })
  })

  it('does not call the RPC for a value with the wrong shape', async () => {
    const { client, rpc } = mockClient({})
    expect(await savePaymentDetails(client, { bank_bsb: '12' })).toEqual({ ok: false, message: 'BSB must be 6 digits' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sends a clear (null) through', async () => {
    const { client, rpc } = mockClient({ data: {} })
    await savePaymentDetails(client, { abn: null })
    expect(rpc).toHaveBeenCalledWith('set_my_payment_details', { p_details: { abn: null } })
  })

  it('maps the database errors to sentences for the MC', async () => {
    const shape = mockClient({ error: { code: '22023', message: 'ABN must be 11 digits' } })
    expect(await savePaymentDetails(shape.client, { abn: '51824753556' })).toEqual({
      ok: false,
      message: 'ABN must be 11 digits',
    })
    const twoFactor = mockClient({ error: { code: '42501', message: 'second factor required' } })
    expect(await savePaymentDetails(twoFactor.client, { abn: '51824753556' })).toEqual({
      ok: false,
      message: 'Confirm your two-factor code, then try again.',
    })
    expect(twoFactor.refreshSession).not.toHaveBeenCalled()
    const other = mockClient({ error: { code: 'XX000', message: 'boom' } })
    expect(await savePaymentDetails(other.client, { abn: '51824753556' })).toEqual({
      ok: false,
      message: 'Could not save your payment details.',
    })
  })

  it('logs an unexpected failure once, with the code and key names but no values (fix round 1, M4)', async () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const other = mockClient({ error: { code: 'XX000', message: 'boom 51824753556' } })
    await savePaymentDetails(other.client, { abn: '51824753556' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('payment details save failed', undefined, { code: 'XX000', keys: ['abn'] })
    expect(JSON.stringify(spy.mock.calls)).not.toContain('51824753556')

    // The expected refusals are not logged.
    spy.mockClear()
    await savePaymentDetails(mockClient({ error: { code: '42501', message: 'x' } }).client, { abn: '51824753556' })
    await savePaymentDetails(mockClient({ error: { code: '22023', message: 'x' } }).client, { abn: '51824753556' })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
