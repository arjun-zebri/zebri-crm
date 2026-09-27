// @vitest-environment node
/**
 * The auth wall in `middleware.ts`, for sessionless requests.
 *
 * Provider webhooks and token-gated public pages carry no session cookie,
 * so a path missing from `PUBLIC_ROUTES` is redirected to `/login` and its
 * handler never runs. Route-handler tests call `POST()` directly and cannot
 * see that, which is how the questionnaire fill page, and later the Resend
 * webhook, ended up unreachable. Each case pairs a public path with a
 * private one, so the file cannot pass by making everything public.
 *
 * Supabase is stubbed to report no user: that is exactly what a request
 * from Resend or a logged-out couple looks like to the middleware. The
 * node environment is needed because `NextResponse.next({ request })`
 * rejects jsdom's `Headers`.
 */

import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}))

import { middleware } from '@/middleware'

/** Run the middleware on a cookieless request and report where it sent it. */
async function sessionless(path: string, method = 'GET') {
  const res = await middleware(new NextRequest(`https://app.zebri.test${path}`, { method }))
  const location = res.headers.get('location')
  return { redirectedToLogin: location !== null && new URL(location).pathname === '/login' }
}

describe('middleware auth wall, sessionless', () => {
  it('lets a Resend webhook delivery through to its handler', async () => {
    expect(await sessionless('/api/resend/webhook', 'POST')).toEqual({ redirectedToLogin: false })
  })

  // The RFC 8058 one-click POST a mailbox provider sends to the
  // List-Unsubscribe URL carries no cookie. Behind the auth wall it would
  // be redirected to /login and the opt-out never recorded.
  it('lets the one-click unsubscribe POST through to its handler', async () => {
    expect(await sessionless('/api/unsubscribe/abc.def', 'POST')).toEqual({ redirectedToLogin: false })
  })

  it('lets a logged-out person open the unsubscribe page', async () => {
    expect(await sessionless('/unsubscribe/abc.def')).toEqual({ redirectedToLogin: false })
  })

  it('still sends a private dashboard path to /login', async () => {
    expect(await sessionless('/couples')).toEqual({ redirectedToLogin: true })
  })

  it('still sends a private API path to /login', async () => {
    expect(await sessionless('/api/couples', 'POST')).toEqual({ redirectedToLogin: true })
  })

  it('does not open sibling paths under /api/resend', async () => {
    expect(await sessionless('/api/resend/other', 'POST')).toEqual({ redirectedToLogin: true })
  })
})
