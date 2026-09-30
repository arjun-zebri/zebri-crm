'use server'

/**
 * Server actions for the /proposals analytics figures: the account strip
 * and the per-template chips. Each calls a `security invoker` SQL function,
 * so RLS scopes the numbers to the signed-in MC. A caller without MFA gets
 * empty or zero rows back, which the UI renders as its empty state rather
 * than an error.
 *
 * @module features/proposals/analytics/data
 */
import { createClient } from '@/lib/supabase/server'

import { acceptanceRate, type AccountSummary, type TemplateStats } from './types'

type Fail = { ok: false; error: string }

/**
 * PostgREST returns `numeric` columns as strings and `null` aggregates as
 * null, whatever the generated types claim; coerce and guard so a bad cell
 * never becomes `NaN` on screen.
 */
function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Account-wide rollup for the strip on /proposals. Zero rows (no MFA) read as an empty account. */
export async function getAccountSummaryAction(): Promise<{ ok: true; summary: AccountSummary } | Fail> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('proposal_account_summary')
  if (error) return { ok: false, error: error.message }
  const row = data?.[0]
  const sent = num(row?.sent)
  const accepted = num(row?.accepted)
  return {
    ok: true,
    summary: {
      sent,
      accepted,
      acceptancePct: acceptanceRate({ sent, accepted }),
      medianOpenSeconds: numOrNull(row?.median_open_seconds),
      revenueThisMonth: Math.round(num(row?.revenue_this_month)),
    },
  }
}

/** Per-template outcomes keyed by template id, for the chips on the template cards. */
export async function getTemplatePerformanceAction(): Promise<{ ok: true; byTemplate: Record<string, TemplateStats> } | Fail> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('proposal_template_performance')
  if (error) return { ok: false, error: error.message }
  const byTemplate: Record<string, TemplateStats> = {}
  for (const row of data ?? []) {
    byTemplate[row.template_id] = {
      sent: num(row.sent),
      accepted: num(row.accepted),
      revenue: Math.round(num(row.revenue)),
      medianOpenSeconds: numOrNull(row.median_open_seconds),
    }
  }
  return { ok: true, byTemplate }
}
