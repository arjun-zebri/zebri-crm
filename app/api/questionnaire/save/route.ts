/**
 * Couple-facing questionnaire autosave endpoint.
 *
 * Persists partial answers as the couple works through the flow. The share
 * token IS the capability; `save_questionnaire_progress` (SECURITY DEFINER)
 * validates it against `share_token_enabled = true` and refuses once the
 * questionnaire is completed.
 *
 * Unauthenticated. Rate-limited generously (autosave fires often) but still
 * capped to blunt abuse. Errors are generic to the couple; detail is logged.
 *
 * @module app/api/questionnaire/save/route
 */
import { type NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/alerts/logger'
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit'
import { parseJsonBody } from '@/lib/api/validate'
import { questionnaireWriteSchema } from '@/lib/questionnaires/api-schema'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

// Autosave is debounced client-side (~1/sec at most); 30/min/IP leaves
// generous headroom while still capping a runaway loop.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 30 })

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
  const { data, error } = await supabase.rpc('save_questionnaire_progress', {
    token,
    p_responses: responses as Json,
  })
  if (error) {
    logger.error('[questionnaire/save] save_questionnaire_progress RPC failed', error, { token })
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }

  const result = (data ?? {}) as { success?: boolean; error?: string }
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
