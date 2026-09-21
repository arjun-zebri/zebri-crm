/**
 * Beacon-only fallback for the proposal template editor's autosave.
 *
 * The editor's normal save path is `updateTemplateLayoutAction`, a Server
 * Action - `navigator.sendBeacon` (and `fetch(..., { keepalive: true })`)
 * can't target one, since the RSC action-invocation protocol needs headers
 * and encoding neither can send. Without a plain endpoint, a browser
 * refresh or tab close inside the 800ms autosave debounce silently dropped
 * the pending edit (see `use-template-autosave.ts`'s module doc). This
 * route exists solely so the editor's `beforeunload` handler has something
 * `sendBeacon` can call: same validation and ownership check as the
 * action, no rate limiting (an authenticated same-origin write, not a
 * public/money surface), and a response nothing ever reads (the page is
 * unloading by the time it would arrive).
 *
 * Same `revision = baseRevision` guard as the action, but this write does
 * NOT bump the revision. The client never learns whether a beacon landed
 * (no response is read), so if it did bump, the reloaded tab - restored
 * from its local draft, still based on the old revision - would have its
 * first real autosave refused as a conflict for content it wrote itself.
 * Leaving the revision alone keeps the beacon a same-generation overwrite:
 * a stale tab still can't clobber a newer write, and the follow-up
 * autosave lands normally.
 *
 * @module app/api/proposals/templates/layout-beacon/route
 */
import { NextResponse } from 'next/server'

import { updateTemplateLayoutSchema } from '@/features/proposals'
import { logger } from '@/lib/alerts/logger'
import { parseJsonBody } from '@/lib/api/validate'
import { createClient } from '@/lib/supabase/server'
import { toPlainJSON } from '@/lib/utils'
import type { Json } from '@/types/database'

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, updateTemplateLayoutSchema)
  if (!parsed.ok) return parsed.response

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, count } = await supabase
    .from('proposal_templates')
    .update(
      { layout: toPlainJSON(parsed.data.layout) as unknown as Json, updated_at: new Date().toISOString() },
      { count: 'exact' }
    )
    .eq('id', parsed.data.id)
    .eq('revision', parsed.data.baseRevision)

  if (error) {
    logger.error('proposal_templates_layout_beacon_failed', error, { userId: user.id })
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  if (count) return NextResponse.json({ ok: true })
  // Zero rows: not ours / gone, or the revision moved on. Nothing reads
  // this response in production, but the split keeps the route honest for
  // its integration test and any future caller.
  const { data: current } = await supabase.from('proposal_templates').select('id').eq('id', parsed.data.id).maybeSingle()
  if (!current) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  return NextResponse.json({ error: 'Template changed elsewhere' }, { status: 409 })
}
