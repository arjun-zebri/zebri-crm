/**
 * Starter-template library well-formedness tests.
 *
 * A typo'd variable path (e.g. `couple.primaryname`) would resolve to
 * empty forever and permanently block any send using it, so we assert
 * every mention id + subject token across the seeded set points at a
 * variable the resolver actually knows. Also guards structural basics:
 * unique names, valid stages, non-empty subject/body.
 */
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import { extractTokens } from '@/lib/automations/variables'
import { STARTER_EMAIL_TEMPLATES } from '@/lib/email/starter-templates'

const LIFECYCLE_STAGES = ['enquiry', 'quote', 'booking', 'planning', 'wedding_week', 'follow_up']

// Variable paths the resolver (lib/automations/variables readPath) knows.
const KNOWN_PATHS = new Set([
  'couple.name', 'couple.full_name', 'couple.primary_name', 'couple.partner1',
  'couple.spouse_name', 'couple.partner2', 'couple.email', 'couple.phone', 'couple.status',
  'event.date', 'event.days_until', 'event.days_since', 'event.weekday',
  'venue.name',
  'mc.business_name', 'mc.name', 'mc.contact_name', 'mc.email', 'mc.phone', 'mc.signature',
  'portal.link',
  'quote.link', 'quote.number', 'quote.total',
  'proposal.link', 'proposal.number', 'proposal.total',
  'invoice.link', 'invoice.number', 'invoice.total',
  'contract.link', 'contract.number',
])

function basePath(expr: string): string {
  return (expr.split('|')[0] ?? expr).trim()
}

/** Collect every mention id from a TipTap doc. */
function mentionPaths(node: JSONContent, out: string[] = []): string[] {
  if (node.type === 'mention' && node.attrs?.id) out.push(String(node.attrs.id))
  if (Array.isArray(node.content)) for (const c of node.content) mentionPaths(c, out)
  return out
}

describe('STARTER_EMAIL_TEMPLATES', () => {
  // The catalog was deliberately trimmed (2026-07-09 spec): starters are
  // a small guide showing how a template is built, not a full library —
  // most MCs write their own. Exemplars spanning the funnel; the
  // proposal cover email joined when proposals replaced quotes
  // (proposals rollout, 2026-07-10 — the quote exemplar leaves with
  // the quotes feature).
  it('ships the agreed exemplars spanning the funnel', () => {
    expect(STARTER_EMAIL_TEMPLATES.map((t) => t.name)).toEqual([
      'Enquiry acknowledgement',
      'Quote cover email',
      'Proposal cover email',
      'You’re booked: confirmation',
    ])
    expect(STARTER_EMAIL_TEMPLATES.map((t) => t.lifecycleStage)).toEqual([
      'enquiry',
      'quote',
      'quote',
      'booking',
    ])
  })

  it('has unique names and valid, non-empty fields', () => {
    const names = STARTER_EMAIL_TEMPLATES.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const t of STARTER_EMAIL_TEMPLATES) {
      expect(t.subject.trim().length).toBeGreaterThan(0)
      expect(LIFECYCLE_STAGES).toContain(t.lifecycleStage)
      expect(t.content.type).toBe('doc')
      expect((t.content.content ?? []).length).toBeGreaterThan(0)
    }
  })

  it('only references variables the resolver knows', () => {
    for (const t of STARTER_EMAIL_TEMPLATES) {
      for (const expr of extractTokens(t.subject)) {
        expect(KNOWN_PATHS, `${t.name} subject uses ${expr}`).toContain(basePath(expr))
      }
      for (const id of mentionPaths(t.content)) {
        expect(KNOWN_PATHS, `${t.name} body uses ${id}`).toContain(basePath(id))
      }
    }
  })
})
