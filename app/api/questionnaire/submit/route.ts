/**
 * Couple-facing questionnaire submit endpoint.
 *
 * Stores the final answers, stamps `completed_at`, and (via the
 * `submit_questionnaire` SECURITY DEFINER RPC) spawns a follow-up task for the
 * MC. The share token IS the capability; the RPC validates it and refuses a
 * second submission.
 *
 * Unauthenticated. Rate-limited at the public category; errors are generic to
 * the couple with detail logged server-side.
 *
 * @module app/api/questionnaire/submit/route
 */
import { type NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/alerts/logger'
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit'
import { parseJsonBody } from '@/lib/api/validate'
import { questionnaireWriteSchema } from '@/lib/questionnaires/api-schema'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

// 5 / min / IP — submitting is a one-shot event per questionnaire.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 })

export async function POST(request: NextRequest) {
  const { allowed, retryAfter } = await limiter.check(ipOf(request))
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    })
  }

  const parsed = await parseJsonBody(request, questionnaireWriteSchema)
  if (!parsed.ok) return parsed.response
  const { token, responses } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_questionnaire', {
    token,
    p_responses: responses as Json,
  })
  if (error) {
    logger.error('[questionnaire/submit] submit_questionnaire RPC failed', error, { token })
    return NextResponse.json({ error: 'Could not submit questionnaire' }, { status: 500 })
  }

  const result = (data ?? {}) as { success?: boolean; error?: string }
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
