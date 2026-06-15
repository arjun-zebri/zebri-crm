/**
 * Client-side "generate PDF" for couple documents (vows + run sheet).
 *
 * There's no server PDF renderer, so — like the rest of the app's PDF
 * paths — this opens a print window with formatted HTML and triggers the
 * browser's print-to-PDF. Data is read RLS-scoped via the browser client.
 *
 * @module app/(dashboard)/couples/print-couple-docs
 */
'use client'

import { createClient } from '@/lib/supabase/client'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 48px; line-height: 1.5; }
  h1 { font-size: 24px; margin: 0 0 24px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; margin: 28px 0 8px; }
  p { white-space: pre-wrap; margin: 0 0 12px; }
  .muted { color: #777; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 14px; }
  td:first-child { width: 72px; white-space: nowrap; color: #555; font-variant-numeric: tabular-nums; }
  td:last-child { width: 80px; white-space: nowrap; color: #777; text-align: right; }
  @media print { body { margin: 24px; } }
`

function openPrint(title: string, body: string): void {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body>${body}</body></html>`
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

/** Print a single partner's vow. */
export async function printVowPdf(coupleId: string, who: string, name: string): Promise<void> {
  const supabase = createClient()
  const { data } = await supabase
    .from('vows' as never)
    .select('content')
    .eq('couple_id', coupleId)
    .eq('who', who)
    .maybeSingle()
  const content = (data as { content: string } | null)?.content

  openPrint(
    `Vow — ${name}`,
    `<h1>Vows</h1><h2>${escapeHtml(name)}</h2><p>${
      content ? escapeHtml(content) : '<span class="muted">No vows written.</span>'
    }</p>`,
  )
}

/** Print the couple's run sheet (the timeline of their earliest event). */
export async function printTimelinePdf(coupleId: string, coupleName: string): Promise<void> {
  const supabase = createClient()
  const { data: ev } = await supabase
    .from('events')
    .select('id')
    .eq('couple_id', coupleId)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()
  const eventId = (ev as { id: string } | null)?.id

  let rows = ''
  if (eventId) {
    const { data: items } = await supabase
      .from('timeline_items')
      .select('start_time, title, description, duration_min')
      .eq('event_id', eventId)
      .order('start_time', { ascending: true })
    rows = ((items ?? []) as Array<{
      start_time: string | null
      title: string
      description: string | null
      duration_min: number | null
    }>)
      .map(
        (it) =>
          `<tr><td>${it.start_time ? escapeHtml(it.start_time.slice(0, 5)) : ''}</td>` +
          `<td><strong>${escapeHtml(it.title)}</strong>${it.description ? `<br/><span class="muted">${escapeHtml(it.description)}</span>` : ''}</td>` +
          `<td>${it.duration_min ? `${it.duration_min} min` : ''}</td></tr>`,
      )
      .join('')
  }

  openPrint(
    'Run sheet',
    `<h1>Run sheet — ${escapeHtml(coupleName)}</h1><table><tbody>${
      rows || '<tr><td colspan="3" class="muted">No timeline items yet.</td></tr>'
    }</tbody></table>`,
  )
}
