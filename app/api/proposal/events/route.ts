/**
 * POST /api/proposal/events: the public page's engagement tracker flushes
 * batches here (every 10 s and on pagehide via sendBeacon, so the body may
 * arrive as text/plain). Validates the vocabulary, limits per IP, and hands
 * the batch to the share-token-gated `record_proposal_events` RPC. When the
 * RPC reports the proposal's first open, the MC is told (email + Slack)
 * after the response has been sent (`after()`).
 *
 * @module app/api/proposal/events/route
 */
import { after, type NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/alerts/logger'
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter'
import { inMemoryLimiter, ipOf, PROPOSAL_RATE_LIMITS } from '@/lib/api/rate-limit'
import { parseJsonBody } from '@/lib/api/validate'
import { eventsBodySchema } from '@/lib/proposals/engagement-events'
import { notifyProposalOpened } from '@/lib/proposals/notify-opened'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const limiter = inMemoryLimiter(PROPOSAL_RATE_LIMITS.events)

export async function POST(request: NextRequest) {
  const ip = ipOf(request)
  const { allowed, retryAfter } = await limiter.check(ip)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
  }

  // sendBeacon cannot set application/json, but `Request#json()` parses the
  // raw body regardless of Content-Type, so the same helper (and the same
  // 400 shape) covers both transports without a manual parse.
  const parsed = await parseJsonBody(request, eventsBodySchema, () => NextResponse.json({ error: 'Invalid events' }, { status: 400 }))
  if (!parsed.ok) return parsed.response
  const { token, sessionId, events } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_proposal_events', { p_token: token, p_session_id: sessionId, p_events: events })
  if (error) {
    logger.error('[proposal/events] record_proposal_events failed', error)
    return NextResponse.json({ error: 'Could not record events' }, { status: 500 })
  }
  const r = (data ?? {}) as { ok?: boolean; error?: string; inserted?: number; first_open?: boolean }
  if (r.error) {
    // m3: act on the limiter's verdict, the way its own example does --
    // recording the miss without checking `allowed` left the scanning cap
    // this route opted into blocking nothing. Once a caller is over the
    // cap, respond with the same generic shape the malformed-body path
    // uses below, rather than the distinguishable `not_found`: a scanner
    // that has tripped the cap should not be able to tell that from an
    // ordinary validation failure.
    if (r.error === 'not_found') {
      const miss = await recordInvalidTokenAttempt({ ip, surface: 'proposal' })
      if (!miss.allowed) return NextResponse.json({ error: 'Invalid events' }, { status: 400 })
    }
    return NextResponse.json({ error: r.error }, { status: 400 })
  }
  if (r.first_open) {
    // M5: `after()` is the supported way to do work once the response has
    // been sent; a bare `void firstOpen(token)` can be killed the moment
    // Vercel reclaims the function, permanently losing the one and only
    // first-open notification. Falls back to running it immediately when
    // there is no request scope to attach to (a script, or this route
    // under a plain unit test), matching `scheduleKick` in
    // `lib/workflows/kick.ts`.
    try {
      after(() => firstOpen(token))
    } catch {
      void firstOpen(token)
    }
  }
  return NextResponse.json({ ok: true, inserted: r.inserted ?? 0 })
}

/** Resolve the proposal behind the token with the admin client and notify the MC. */
async function firstOpen(token: string) {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('proposals').select('id').eq('share_token', token).maybeSingle()
    if (data?.id) await notifyProposalOpened(admin, data.id as string)
  } catch (err) {
    logger.error('[proposal/events] first-open notify failed', err)
  }
}
