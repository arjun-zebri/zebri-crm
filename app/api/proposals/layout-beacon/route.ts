/**
 * Beacon-only fallback for the proposal editor's autosave, the
 * `proposals` twin of `templates/layout-beacon` (roadmap R3 §6.1, "Edit").
 *
 * The editor's normal save path is `updateProposalLayoutAction`, a Server
 * Action - `navigator.sendBeacon` (and `fetch(..., { keepalive: true })`)
 * can't target one, since the RSC action-invocation protocol needs headers
 * and encoding neither can send. Without a plain endpoint, a browser
 * refresh or tab close inside the 800ms autosave debounce silently dropped
 * the pending edit (see `use-layout-autosave.ts`'s module doc). This
 * route exists solely so the editor's `beforeunload` handler has something
 * `sendBeacon` can call: same validation and ownership check as the
 * action, no rate limiting (an authenticated same-origin write, not a
 * public/money surface), and a response nothing ever reads (the page is
 * unloading by the time it would arrive).
 *
 * Same `layout_revision = baseRevision` guard as the action, but this
 * write does NOT bump the revision. The client never learns whether a
 * beacon landed (no response is read), so if it did bump, the reloaded tab
 * - restored from its local draft, still based on the old revision - would
 * have its first real autosave refused as a conflict for content it wrote
 * itself. Leaving the revision alone keeps the beacon a same-generation
 * overwrite: a stale tab still can't clobber a newer write, and the
 * follow-up autosave lands normally.
 *
 * An accepted proposal is frozen, exactly as the action has it: the
 * contract and the invoice were built from the design the couple said yes
 * to. The `.neq` in the statement is what enforces that, rather than a
 * read-then-write the couple could accept in between.
 *
 * @module app/api/proposals/layout-beacon/route
 */
import { NextResponse } from 'next/server'

import { updateProposalLayoutSchema } from '@/features/proposals'
import { logger } from '@/lib/alerts/logger'
import { parseJsonBody } from '@/lib/api/validate'
import { createClient } from '@/lib/supabase/server'
import { toPlainJSON } from '@/lib/utils'
import type { Json } from '@/types/database'

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, updateProposalLayoutSchema)
  if (!parsed.ok) return parsed.response

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, count } = await supabase
    .from('proposals')
    .update(
      { layout: toPlainJSON(parsed.data.layout) as unknown as Json, updated_at: new Date().toISOString() },
      { count: 'exact' }
    )
    .eq('id', parsed.data.id)
    .eq('layout_revision', parsed.data.baseRevision)
    .neq('status', 'accepted')

  if (error) {
    logger.error('proposals_layout_beacon_failed', error, { userId: user.id })
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  if (count) return NextResponse.json({ ok: true })
  // Zero rows: not ours / gone, accepted, or the revision moved on.
  // Nothing reads this response in production, but the split keeps the
  // route honest for its integration test and any future caller.
  const { data: current } = await supabase.from('proposals').select('status').eq('id', parsed.data.id).maybeSingle()
  if (!current) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  if (current.status === 'accepted') {
    return NextResponse.json({ error: 'This proposal has been accepted and can no longer be edited' }, { status: 409 })
  }
  return NextResponse.json({ error: 'Proposal changed elsewhere' }, { status: 409 })
}
