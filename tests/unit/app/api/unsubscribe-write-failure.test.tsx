/**
 * A failed unsubscribe write is loud (Phase 2 whole-phase fix wave, M2),
 * and the page's copy promises only what the send path keeps (M6).
 *
 * The failure of a legal opt-out used to be a log line and a redirect to
 * `?error=invalid`, which the page did not render: the person saw the
 * form again with no word that their click had not counted. Now both
 * write routes alert through `sendAlert`, the form route sends the person
 * back with `?error=write_failed`, the page says so, and the one-click
 * route answers 500 so the mailbox provider can retry.
 *
 * The admin client is a stub whose `email_suppression` insert fails; the
 * real write is covered against the database in
 * `tests/integration/email/unsubscribe.test.ts` and `legal-floor.test.ts`.
 */
import { render, screen } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { insertError: null as null | { code: string; message: string } },
}))

/** A chainable, awaitable stand-in for one PostgREST query. */
function query(result: () => unknown) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'ilike', 'in', 'update']) q[m] = () => q
  q.maybeSingle = async () => ({ data: { name: 'Sarah & Sam' }, error: null })
  q.then = (resolve: (v: unknown) => unknown) => resolve(result())
  return q
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async () => ({ error: state.insertError }),
      ...query(() => ({ data: table === 'couples' ? [] : [], error: null })),
    }),
  }),
}))
vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn(async () => undefined) }))

import { POST as oneClickPost } from '@/app/api/unsubscribe/[token]/route'
import { POST as formPost } from '@/app/api/unsubscribe/route'
import UnsubscribePage from '@/app/unsubscribe/[token]/page'
import { sendAlert } from '@/lib/alerts'
import { createUnsubscribeToken } from '@/lib/email/unsubscribe-token'

const token = createUnsubscribeToken({
  userId: '11111111-1111-4111-8111-111111111111',
  coupleId: '22222222-2222-4222-8222-222222222222',
  email: 'sarah@example.com',
})

let ipSeq = 0
function ip(): string {
  ipSeq += 1
  return `10.99.0.${ipSeq}`
}

beforeEach(() => {
  state.insertError = { code: 'XX000', message: 'disk full' }
  vi.mocked(sendAlert).mockClear()
})

describe('a failed unsubscribe write', () => {
  it('the form route alerts and sends the person back with error=write_failed', async () => {
    const form = new FormData()
    form.set('token', token)
    const res = await formPost(
      new NextRequest('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip() },
        body: form,
      }),
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=write_failed')
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_error', source: 'unsubscribe' }),
    )
  })

  it('the one-click route alerts and answers 500 so the provider can retry', async () => {
    const res = await oneClickPost(
      new NextRequest(`http://localhost/api/unsubscribe/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip() },
        body: 'List-Unsubscribe=One-Click',
      }),
      { params: Promise.resolve({ token }) },
    )
    expect(res.status).toBe(500)
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_error', source: 'unsubscribe' }),
    )
  })

  it('the page tells the person it did not go through', async () => {
    render(
      await UnsubscribePage({
        params: Promise.resolve({ token }),
        searchParams: Promise.resolve({ error: 'write_failed' }),
      }),
    )
    expect(screen.getByText(/couldn.t record that/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unsubscribe me/i })).toBeInTheDocument()
  })
})

describe('the confirmation copy (M6)', () => {
  it('promises marketing and automated emails stop, not every email', async () => {
    render(
      await UnsubscribePage({
        params: Promise.resolve({ token }),
        searchParams: Promise.resolve({}),
      }),
    )
    expect(screen.getByText(/marketing and automated emails/i)).toBeInTheDocument()
    expect(screen.queryByText(/any more emails/i)).not.toBeInTheDocument()
  })
})
