/**
 * Branding editor autosave, metadata half (Task 23c): the ABN goes
 * through the guarded RPC, never through `auth.updateUser`, and only when
 * it changed and has a valid shape.
 */
import { describe, expect, it, vi } from 'vitest'

import type { EditorState } from '@/app/(dashboard)/branding/branding-editor'
import { AbnHeldBackError, saveBrandingMetadata } from '@/app/(dashboard)/branding/save-branding-metadata'

type Client = Parameters<typeof saveBrandingMetadata>[0]

function mockClient(rpcError: { code: string; message: string } | null = null) {
  const updateUser = vi.fn().mockResolvedValue({ error: null })
  const rpc = vi.fn().mockResolvedValue({ data: {}, error: rpcError })
  const refreshSession = vi.fn().mockResolvedValue({ data: {}, error: null })
  const client = { rpc, auth: { updateUser, refreshSession } } as unknown as Client
  return { client, updateUser, rpc }
}

// Only the fields the save reads matter here; the rest are irrelevant.
const state = (abn: string) => ({ abn, kitName: 'Kit', tagline: 'Hi', brandColor: '#000000' }) as unknown as EditorState

const STALE = {
  tagline: 'old',
  bank_account_name: 'Stale Name',
  bank_bsb: '000-000',
  bank_account_number: '0000',
  abn: '00 000 000 000',
}

describe('saveBrandingMetadata', () => {
  it('never sends a payment detail through auth.updateUser, even from stale metadata', async () => {
    const { client, updateUser } = mockClient()
    await saveBrandingMetadata(client, STALE, state('51 824 753 556'), '51 824 753 556')
    const data = updateUser.mock.calls[0]![0].data as Record<string, unknown>
    for (const key of ['bank_account_name', 'bank_bsb', 'bank_account_number', 'abn']) {
      expect(key in data, key).toBe(false)
    }
    expect(data.tagline).toBe('Hi')
  })

  it('does not call the RPC when the ABN is unchanged', async () => {
    const { client, rpc } = mockClient()
    expect(await saveBrandingMetadata(client, {}, state('51 824 753 556'), '51 824 753 556')).toBe('51 824 753 556')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('saves a changed ABN through the RPC, with only the ABN in the payload', async () => {
    const { client, rpc } = mockClient()
    expect(await saveBrandingMetadata(client, {}, state('51 824 753 556'), '')).toBe('51 824 753 556')
    expect(rpc).toHaveBeenCalledWith('set_my_payment_details', { p_details: { abn: '51 824 753 556' } })
  })

  it('clears the ABN through the RPC', async () => {
    const { client, rpc } = mockClient()
    expect(await saveBrandingMetadata(client, {}, state(''), '51 824 753 556')).toBe('')
    expect(rpc).toHaveBeenCalledWith('set_my_payment_details', { p_details: { abn: '' } })
  })

  it('holds back a half-typed ABN: saves the rest, never sends it, and does not report success', async () => {
    const { client, rpc, updateUser } = mockClient()
    await expect(saveBrandingMetadata(client, {}, state('51 824'), '')).rejects.toBeInstanceOf(AbnHeldBackError)
    expect(rpc).not.toHaveBeenCalled()
    expect(updateUser).toHaveBeenCalled()
  })

  it('throws when the RPC refuses, so the autosave retries', async () => {
    const { client } = mockClient({ code: '42501', message: 'second factor required' })
    await expect(saveBrandingMetadata(client, {}, state('51 824 753 556'), '')).rejects.toThrow(
      'Confirm your two-factor code, then try again.',
    )
  })
})
