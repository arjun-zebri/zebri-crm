/**
 * The manual send and its preview answer a failed read with a readable
 * message (Task 36 fix round 1, review I2).
 *
 * `loadCoupleSnapshot` now throws on a failed read rather than answering
 * "no couple". Uncaught, the route answered with Next's HTML 500, which
 * the compose modal cannot parse, and the preview action threw into the
 * modal. The route now answers JSON 500 with a sentence the modal already
 * toasts, and the action answers `{ ok: false, error }`.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn(async () => undefined) }))
vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}))

const buildManualSendContext = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email/send-context', () => ({
  buildManualSendContext,
  downloadStaticAttachments: vi.fn(async () => []),
}))

import { loadSendContextAction } from '@/app/(dashboard)/couples/send-email-actions'
import { POST } from '@/app/api/email/send-template/route'
import { CONTEXT_UNREADABLE, WorkflowReadError } from '@/lib/workflows/read-failure'

const COUPLE_ID = '22222222-2222-4222-8222-222222222222'

function request() {
  return new NextRequest('https://zebri.test/api/email/send-template', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ coupleId: COUPLE_ID, inlineSubject: 'Hi', inlineBody: { type: 'doc' } }),
  })
}

describe('manual send on a failed couple read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    buildManualSendContext.mockRejectedValue(
      new WorkflowReadError('context.couple', { message: 'connection reset' }, CONTEXT_UNREADABLE),
    )
  })

  it('the route answers JSON 500 with a readable message', async () => {
    const res = await POST(request())
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe(CONTEXT_UNREADABLE)
    expect(body.error).not.toContain('connection reset')
  })

  it('the preview action answers ok: false with the readable message', async () => {
    expect(await loadSendContextAction(COUPLE_ID)).toEqual({ ok: false, error: CONTEXT_UNREADABLE })
  })
})
