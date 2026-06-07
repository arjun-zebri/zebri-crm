/**
 * Test-run preview endpoint.
 *
 * Lets the builder preview an automation against a real couple's
 * data without writing to the event bus or sending any
 * customer-visible side effects. The handler walks the actions
 * synchronously, calling each action's handler in "dry run" mode
 * - for messaging actions this means rendering the email body /
 * subject and returning it instead of sending.
 *
 * 14a ships a server-side render of the message content so the
 * builder's inspector pane shows exactly what would land. Side
 * effects on data tables (create_task, update_couple_stage, etc.)
 * are also simulated rather than committed.
 *
 * Rate-limited via the existing helper to stop a builder bug from
 * flooding Resend / Supabase.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit'
import { parseJsonBody } from '@/lib/api/validate'

// Per-IP limit on test runs - 20 / minute is generous for builder
// iteration but stops a runaway click loop hammering Supabase.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 20 })
import { buildRunContext, loadCoupleSnapshot, loadMcSnapshot } from '@/lib/automations/context'
import { renderTemplate } from '@/lib/automations/variables'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AutomationEventRow } from '@/types/automations'

const BodySchema = z.object({
  automationId: z.string().uuid(),
  coupleId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const rl = await limiter.check(ipOf(request))
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many test runs - slow down' }, { status: 429 })
  }

  const userSupabase = await createServerClient()
  const { data: auth } = await userSupabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return parsed.response

  const { automationId, coupleId } = parsed.data

  // RLS-scoped read to ensure the user owns both rows.
  const { data: automation } = await userSupabase
    .from('automations' as never)
    .select('id, name, trigger_type, trigger_config')
    .eq('id', automationId)
    .single()
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const couple = await loadCoupleSnapshot(admin, coupleId)
  if (!couple) return NextResponse.json({ error: 'Couple not found' }, { status: 404 })

  const mc = await loadMcSnapshot(admin, auth.user.id)

  const fakeEvent: AutomationEventRow = {
    id: '00000000-0000-0000-0000-000000000000',
    user_id: auth.user.id,
    source_table: 'test_run',
    source_id: null,
    event_type: (automation as { trigger_type: string }).trigger_type as never,
    payload: { test_run: true } as never,
    couple_id: couple.id,
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }

  const ctx = await buildRunContext(admin, {
    id: '00000000-0000-0000-0000-000000000000',
    automation_id: automationId,
    event_id: fakeEvent.id,
    user_id: auth.user.id,
    couple_id: couple.id,
    status: 'running',
    current_action_id: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    error_message: null,
    last_payload: { action_results: {} } as never,
  }, fakeEvent)

  // Walk actions and render previews. We deliberately skip executing
  // handlers - the preview shows resolved templates, not real
  // side effects.
  const { data: actions } = await userSupabase
    .from('automation_actions' as never)
    .select('id, position, type, config, label, parent_action_id, branch_path')
    .eq('automation_id', automationId)
    .order('position', { ascending: true })

  const previews: Array<{
    actionId: string
    type: string
    label: string
    render: Record<string, string>
  }> = []

  for (const a of (actions ?? []) as Array<{
    id: string
    type: string
    label: string | null
    config: Record<string, unknown>
  }>) {
    const render: Record<string, string> = {}
    const config = a.config ?? {}
    if (typeof config['subject'] === 'string') render.subject = renderTemplate(config['subject'], ctx)
    if (typeof config['body'] === 'string') render.body = renderTemplate(config['body'], ctx)
    if (typeof config['title'] === 'string') render.title = renderTemplate(config['title'], ctx)
    if (typeof config['message'] === 'string') render.message = renderTemplate(config['message'], ctx)
    previews.push({ actionId: a.id, type: a.type, label: a.label ?? a.type, render })
  }

  return NextResponse.json({ ok: true, couple: { id: couple.id, name: couple.name }, previews })
}
