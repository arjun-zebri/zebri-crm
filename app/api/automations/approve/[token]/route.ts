/**
 * Approval-gate handler.
 *
 * An `approval` action suspends the run and emails the configured
 * approver a magic-link URL of the shape
 * `/api/automations/approve/<token>?decision=approve|deny`. This
 * route consumes the token, marks the wait row, and resumes (or
 * cancels) the run.
 *
 * The token lives on automation_waits.token with a unique index;
 * a tampered or already-consumed token returns 404 without leaking
 * detail.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function GET(request: NextRequest, ctx: RouteParams) {
  const { token } = await ctx.params
  const decision = (request.nextUrl.searchParams.get('decision') ?? 'approve').toLowerCase()
  if (!['approve', 'deny'].includes(decision)) {
    return NextResponse.json({ error: 'invalid decision' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: wait } = await supabase
    .from('automation_waits' as never)
    .select('id, run_id, consumed_at')
    .eq('token', token)
    .maybeSingle()

  if (!wait || (wait as { consumed_at: string | null }).consumed_at) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const row = wait as { id: string; run_id: string }
  const nowIso = new Date().toISOString()

  await supabase.from('automation_waits' as never).update({ consumed_at: nowIso } as never).eq('id', row.id)

  const runUpdate = decision === 'approve' ? { status: 'running' } : { status: 'cancelled', completed_at: nowIso }
  await supabase.from('automation_runs' as never).update(runUpdate as never).eq('id', row.run_id)

  await supabase.from('automation_audit_log' as never).insert({
    automation_id: '00000000-0000-0000-0000-000000000000',
    run_id: row.run_id,
    user_id: '00000000-0000-0000-0000-000000000000',
    event: decision === 'approve' ? 'approval_granted' : 'approval_denied',
    details: { token: token.slice(0, 8) },
  } as never)

  return new NextResponse(
    decision === 'approve'
      ? '<p>Approved. The automation will continue.</p>'
      : '<p>Denied. The automation has been cancelled.</p>',
    { status: 200, headers: { 'content-type': 'text/html' } },
  )
}
