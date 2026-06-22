/**
 * Email-template renderer + missing-variable detector tests.
 *
 * Covers `lib/email/templates`: TipTap body rendering against a
 * RunContext, subject rendering, and the missing-variable gate that
 * guarantees an email never goes out with an unfilled variable.
 */
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import {
  detectMissingVariables,
  renderEmailSubject,
  renderEmailTemplate,
  resolveTemplateContent,
} from '@/lib/email/templates'
import type { RunContext } from '@/types/automations'

function makeCtx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    userId: 'u',
    automationId: 'a',
    runId: 'r',
    coupleId: 'c',
    triggerEvent: {
      id: 'e',
      user_id: 'u',
      source_table: 'couples',
      source_id: 'c',
      event_type: 'new_enquiry' as never,
      payload: {} as never,
      couple_id: 'c',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'c',
      name: 'Sam & Alex',
      email: 'sam@example.com',
      phone: '0412 345 678',
      eventDate: '2026-12-12',
      venue: 'The Calile',
      status: 'confirmed',
      primaryName: 'Sam',
      spouseName: 'Alex',
      spouseEmail: 'alex@example.com',
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    mc: {
      userId: 'u',
      businessName: 'Acme MC Co',
      contactName: 'Charlie',
      email: 'charlie@acmemc.com',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: '21:00',
      quietHoursEnd: '08:00',
      quietHoursTimezone: 'Australia/Sydney',
    },
    actionResults: {},
    ...overrides,
  }
}

/** Build a one-paragraph TipTap doc from inline text + mention ids. */
function doc(...nodes: JSONContent[]): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph', content: nodes }] }
}
const text = (t: string): JSONContent => ({ type: 'text', text: t })
const mention = (id: string): JSONContent => ({ type: 'mention', attrs: { id } })

describe('renderEmailTemplate', () => {
  it('substitutes mention nodes with resolved values', () => {
    const body = doc(text('Hi '), mention('couple.primary_name'), text('!'))
    const { html, unresolved } = renderEmailTemplate(body, makeCtx())
    expect(html).toContain('Hi Sam!')
    expect(unresolved).toEqual([])
  })

  it('applies filters declared on the mention id', () => {
    const body = doc(mention('event.date | friendly'))
    const { html } = renderEmailTemplate(body, makeCtx())
    expect(html).toMatch(/Sat|2026/)
  })

  it('reports unresolved variables and drops them in send mode', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, spouseName: null } })
    const body = doc(text('To '), mention('couple.spouse_name'))
    const { html, unresolved } = renderEmailTemplate(body, ctx, 'send')
    expect(unresolved).toEqual(['couple.spouse_name'])
    expect(html).not.toContain('data-missing-var')
  })

  it('highlights unresolved variables in preview mode', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, spouseName: null } })
    const body = doc(mention('couple.spouse_name'))
    const { html, unresolved } = renderEmailTemplate(body, ctx, 'preview')
    expect(unresolved).toEqual(['couple.spouse_name'])
    expect(html).toContain('data-missing-var="true"')
    expect(html).toContain('Spouse / partner')
  })

  it('fills a missing variable from an inline override', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, spouseName: null } })
    const body = doc(text('To '), mention('couple.spouse_name'))
    const { html, unresolved } = renderEmailTemplate(body, ctx, 'send', {
      'couple.spouse_name': 'Jordan',
    })
    expect(unresolved).toEqual([])
    expect(html).toContain('To Jordan')
  })

  it('treats a default: filter as resolved, not missing', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, spouseName: null } })
    const body = doc(mention('couple.spouse_name | default:your partner'))
    const { html, unresolved } = renderEmailTemplate(body, ctx)
    expect(unresolved).toEqual([])
    expect(html).toContain('your partner')
  })

  // A mention that lost its `attrs.id` (e.g. an HTML copy-paste round-trip
  // through the editor) must never reach TipTap's default Mention renderer,
  // which would stringify the null id as the literal "@null".
  it('never emits "null" for a mention with no attrs.id', () => {
    const corrupt: JSONContent = { type: 'mention' }
    const body = doc(text('Hi '), corrupt, text(','))
    const { html } = renderEmailTemplate(body, makeCtx(), 'send')
    expect(html).not.toContain('null')
    // Collapses to whitespace like any unresolved variable — no mention span.
    expect(html).not.toContain('<span')
    expect(html.replace(/\s+/g, ' ')).toBe('<p>Hi ,</p>')
  })

  it('does not emit "null" for a corrupted mention in preview mode', () => {
    const corrupt: JSONContent = { type: 'mention', attrs: { id: null } as never }
    const { html } = renderEmailTemplate(doc(corrupt), makeCtx(), 'preview')
    expect(html).not.toContain('null')
  })

  it('keeps intentional blank lines (empty paragraphs get a <br>)', () => {
    const body: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [text('Hi,')] },
        { type: 'paragraph' },
        { type: 'paragraph' },
        { type: 'paragraph', content: [text('Bye')] },
      ],
    }
    const { html } = renderEmailTemplate(body, makeCtx(), 'send')
    // Both blank lines survive with height — no bare <p></p> left.
    expect(html).not.toContain('<p></p>')
    expect(html.match(/<p><br \/>?><\/p>|<p><br><\/p>/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

describe('resolveTemplateContent', () => {
  /** Flatten a resolved doc to its concatenated text. */
  function flat(node: JSONContent): string {
    if (node.type === 'text') return node.text ?? ''
    return (node.content ?? []).map(flat).join('')
  }

  /** Collect every node type in the doc (for asserting on mentions). */
  function types(node: JSONContent): string[] {
    return [node.type ?? '', ...(node.content ?? []).flatMap(types)]
  }

  it('replaces resolvable mentions with their value as plain text', () => {
    const body = doc(text('Hi '), mention('couple.primary_name'), text('!'))
    const resolved = resolveTemplateContent(body, makeCtx())
    expect(flat(resolved)).toBe('Hi Sam!')
    expect(types(resolved)).not.toContain('mention')
  })

  it('leaves an unresolvable variable as a mention so the editor can highlight it', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, eventDate: null } })
    const body = doc(text('On '), mention('event.date | friendly'))
    const resolved = resolveTemplateContent(body, ctx)
    expect(types(resolved)).toContain('mention')
  })

  // The manual compose flow: the editable preview is seeded via
  // resolveTemplateContent, the MC's edits are sent verbatim, then the
  // server renders that content. The signature must survive as a mention
  // so it lands as rich HTML on send, not flattened plain text.
  it('keeps the signature as a mention so the inline send renders it as rich HTML', () => {
    const sigDoc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Charlie' }] }],
    }
    const ctx = makeCtx({ mc: { ...makeCtx().mc, signature: sigDoc } })
    const body = doc(text('Bye '), mention('mc.signature'))
    // 1. Editable preview keeps the signature mention (not flattened).
    const preview = resolveTemplateContent(body, ctx)
    expect(types(preview)).toContain('mention')
    // 2. Sending that preview content renders the signature as rich HTML.
    const { html } = renderEmailTemplate(preview, ctx, 'send')
    expect(html).toContain('<strong>Charlie</strong>')
  })

  it('drops a corrupted mention (no attrs.id) rather than keeping a "null" chip', () => {
    const corrupt: JSONContent = { type: 'mention' }
    const resolved = resolveTemplateContent(doc(text('Hi '), corrupt), makeCtx())
    expect(types(resolved)).not.toContain('mention')
    expect(flat(resolved)).toBe('Hi ')
  })
})

describe('renderEmailSubject', () => {
  it('renders mustache tokens', () => {
    expect(renderEmailSubject('Quote for {{couple.name}}', makeCtx())).toBe('Quote for Sam & Alex')
  })

  it('brackets missing tokens in preview and drops them when sending', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, spouseName: null } })
    expect(renderEmailSubject('Hi {{couple.spouse_name}}', ctx, 'preview')).toBe('Hi [Spouse / partner]')
    expect(renderEmailSubject('Hi {{couple.spouse_name}}', ctx, 'send')).toBe('Hi ')
  })
})

describe('mc.signature variable', () => {
  /** A signature doc: one or more paragraphs of inline nodes. */
  function sig(...paras: JSONContent[][]): JSONContent {
    return { type: 'doc', content: paras.map((nodes) => ({ type: 'paragraph', content: nodes })) }
  }
  const bold = (t: string): JSONContent => ({ type: 'text', marks: [{ type: 'bold' }], text: t })

  it('injects the signature as rich HTML, preserving formatting', () => {
    const ctx = makeCtx({
      mc: { ...makeCtx().mc, signature: sig([text('Cheers, '), bold('Charlie')]) },
    })
    const { html, unresolved } = renderEmailTemplate(doc(text('Bye '), mention('mc.signature')), ctx, 'send')
    expect(html).toContain('Cheers, ')
    expect(html).toContain('<strong>Charlie</strong>')
    expect(unresolved).toEqual([])
  })

  it('renders an empty signature as nothing and never flags it missing', () => {
    const ctx = makeCtx({ mc: { ...makeCtx().mc, signature: null } })
    const body = doc(text('Bye'), mention('mc.signature'))
    const { unresolved } = renderEmailTemplate(body, ctx, 'send')
    expect(unresolved).toEqual([])
    const result = detectMissingVariables({ subject: '', content: body }, ctx)
    expect(result.blocked).toBe(false)
    expect(result.missing).toEqual([])
  })

  it('flattens the signature to plain text in a subject line', () => {
    const ctx = makeCtx({ mc: { ...makeCtx().mc, signature: sig([text('Cheers, Charlie')]) } })
    expect(renderEmailSubject('-- {{mc.signature}}', ctx, 'send')).toBe('-- Cheers, Charlie')
  })
})

describe('detectMissingVariables', () => {
  it('passes when subject + body fully resolve', () => {
    const result = detectMissingVariables(
      { subject: 'For {{couple.name}}', content: doc(mention('mc.business_name')) },
      makeCtx(),
    )
    expect(result.blocked).toBe(false)
    expect(result.missing).toEqual([])
    expect(result.message).toBeUndefined()
  })

  it('clears a missing var when an inline override fills it', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, spouseName: null } })
    const result = detectMissingVariables(
      { subject: 'Hi {{couple.spouse_name}}', content: doc(mention('couple.spouse_name')) },
      ctx,
      { 'couple.spouse_name': 'Jordan' },
    )
    expect(result.blocked).toBe(false)
    expect(result.missing).toEqual([])
  })

  it('collects missing vars from both subject and body, deduped', () => {
    const ctx = makeCtx({ couple: { ...makeCtx().couple!, spouseName: null, venue: null } })
    const result = detectMissingVariables(
      {
        subject: 'Hi {{couple.spouse_name}}',
        content: doc(mention('couple.spouse_name'), mention('venue.name')),
      },
      ctx,
    )
    expect(result.blocked).toBe(true)
    expect(result.missing.sort()).toEqual(['couple.spouse_name', 'venue.name'])
    expect(result.message).toContain('Spouse / partner')
    expect(result.message).toContain('Venue name')
  })
})
