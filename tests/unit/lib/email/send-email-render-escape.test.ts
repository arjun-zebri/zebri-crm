/**
 * A preview's missing-variable label is HTML-escaped exactly once (Phase
 * 5 fix wave, parked Task 29 review M1).
 *
 * The label reaches the highlight already inside escaped HTML (the
 * branded shell escapes a legacy body; TipTap and the sanitiser escape a
 * rich one), so escaping it again showed `{{a & b}}` as "A &amp;amp; b".
 * Unwrapped legacy text is the one path with no escaping around it, so
 * the label is escaped where it is marked there instead. Either way the
 * MC reads the label as typed, and markup in a label stays inert.
 */
import { describe, expect, it } from 'vitest'

import { renderSendEmail } from '@/lib/email/send-email-render'
import type { RunContext } from '@/types/automations'

function ctx(): RunContext {
  return {
    userId: 'u1',
    automationId: 'a1',
    runId: 'r1',
    instanceId: 'r1',
    stepId: 's1',
    coupleId: 'c1',
    triggerEvent: {
      id: 'evt',
      user_id: 'u1',
      source_table: 'couples',
      source_id: 'c1',
      event_type: 'invoice_overdue',
      payload: {},
      couple_id: 'c1',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'c1',
      name: 'Sam & Alex',
      email: 'sam@example.com',
      phone: null,
      eventDate: null,
      venue: null,
      status: 'booked',
      primaryName: 'Sam',
      spouseName: null,
      spouseEmail: null,
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    invoice: null,
    mc: {
      userId: 'u1',
      businessName: 'MC Co',
      contactName: 'Alex MC',
      email: 'alex@mc.test',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: null,
    },
    actionResults: {},
  }
}

/** The text inside each highlight span. */
function labels(html: string): string[] {
  return [...html.matchAll(/data-missing-var="true">([^<]*)</g)].map((m) => m[1]!)
}

const source = (body: string) => ({ kind: 'text' as const, subject: 'Hi', body })

// These tokens are not variables Zebri knows, so since live check B7 the
// label is the token as typed rather than a title-cased guess. The rule
// under test is unchanged: whatever the label, it is escaped exactly once.

describe('missing-variable labels in the preview', () => {
  it('are escaped once inside the branded shell', () => {
    const html = renderSendEmail(source('At {{a & b}} and {{<x>}}'), ctx(), true, { highlightMissing: true }).renderHtml(null)
    expect(labels(html)).toEqual(['{{a &amp; b}}', '{{&lt;x&gt;}}'])
  })

  it('are escaped once without the shell', () => {
    const html = renderSendEmail(source('At {{a & b}} and {{<x>}}'), ctx(), false, { highlightMissing: true }).renderHtml(null)
    expect(labels(html)).toEqual(['{{a &amp; b}}', '{{&lt;x&gt;}}'])
  })

  it('are escaped once in a rich-text body', () => {
    const doc = {
      kind: 'doc' as const,
      subject: 'Hi',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'a & b', label: null } }] }],
      },
    }
    const html = renderSendEmail(doc as never, ctx(), true, { highlightMissing: true }).renderHtml(null)
    expect(labels(html)).toEqual(['{{a &amp; b}}'])
  })

  it('keep markup inert', () => {
    const html = renderSendEmail(source('{{<img src=x onerror=alert(1)>}}'), ctx(), false, { highlightMissing: true }).renderHtml(null)
    expect(html).not.toContain('<img')
  })
})
