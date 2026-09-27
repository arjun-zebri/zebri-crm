/**
 * The envelope is the send (Task 29).
 *
 * The step detail modal shows who a held send goes to, from which
 * address, with which reply-to and attachments, above the rendered
 * email. That line is only worth reading if it agrees with what the send
 * does. So this runs the REAL `send_email` handler and `buildStepPreview`
 * on the same step and context, and compares what was dispatched with
 * what the envelope claims: the same people mailed, the same people
 * skipped, the same From, reply-to, bcc and attachment names.
 *
 * It also pins the unresolved-variable rule: the preview highlights a gap
 * and lists it, and the send's HTML never carries the highlight markup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetWorkflowSendLimitersForTest } from '@/lib/api/rate-limit'
import { getActionSpec } from '@/lib/automations/actions'
import { encryptSecret } from '@/lib/crypto/secret-box'
import { PREVIEW_UNSUBSCRIBE_URL, renderSendEmail } from '@/lib/email/send-email-render'
import { applyReviewEdits, buildStepPreview } from '@/lib/workflows/review'
import type { RunContext } from '@/types/automations'
import { DEFAULT_STEP_TIMING, type WorkflowStepRow } from '@/types/workflows'

const sendMock = vi.fn()
const { suppressed, writes, reads, gate } = vi.hoisted(() => ({
  suppressed: new Set<string>(),
  writes: [] as string[],
  /** Every table and RPC read, to prove an edited preview skips the costly half. */
  reads: [] as string[],
  /** The couple's opt-out flag, and the sending settings row, per test. */
  gate: { coupleOptedOut: false, settings: null as Record<string, unknown> | null },
}))

// A fixed key so a connected mailbox's tokens decrypt in the sender lookup.
process.env.EMAIL_CRED_KEY = Buffer.alloc(32, 7).toString('base64')

vi.mock('@/lib/oauth/tokens', () => ({
  refreshAccessToken: async () => {
    throw new Error('no refresh expected in this test')
  },
}))

vi.mock('@/lib/email/send-log', () => ({
  AUTOMATED_SEND_WINDOW_MS: 24 * 60 * 60 * 1000,
  AUTOMATION_SOURCE: 'automation',
  logAutomatedSend: vi.fn(async () => undefined),
  readAutomatedSendWindow: vi.fn(async () => ({ status: 'ok', count: 0 })),
  automatedSendWindowReopensAt: vi.fn(async () => null),
  transportOf: (sender: { transport: string }) => (sender.transport === 'resend' ? 'resend' : 'gmail'),
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

vi.mock('@/lib/workflows/account-pause', () => ({
  readAccountPause: async () => ({ status: 'running' }),
}))

vi.mock('@/lib/email/suppression', () => ({
  isEmailSuppressed: async (_s: unknown, _u: string, email: string) => ({
    status: suppressed.has(email) ? 'blocked' : 'clear',
  }),
  isCoupleOptedOut: async () => ({ status: gate.coupleOptedOut ? 'blocked' : 'clear' }),
}))

vi.mock('@/lib/email/automation-send', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    buildUnsubscribeLinks: () => ({
      pageUrl: PREVIEW_UNSUBSCRIBE_URL,
      oneClickUrl: 'https://app.test/api/unsubscribe/x',
    }),
  }
})

const TEMPLATE_ID = '7f2c1e58-0000-4000-8000-0000000000aa'
const FILE_TPL = '7f2c1e58-0000-4000-8000-0000000000f1'
const FILE_STEP = '7f2c1e58-0000-4000-8000-0000000000f2'

const FILES: Record<string, { file_name: string; storage_path: string }> = {
  [FILE_TPL]: { file_name: 'Run sheet.pdf', storage_path: 'u1/a.pdf' },
  [FILE_STEP]: { file_name: 'Menu.pdf', storage_path: 'u1/b.pdf' },
}

/**
 * One fake client for both sides, answering every read they make. Any
 * insert, update, upsert or delete is recorded so the test can prove the
 * envelope wrote nothing.
 */
function fakeClient() {
  const chain = (table: string): Record<string, unknown> => {
    const self: Record<string, unknown> = {}
    let inIds: string[] | null = null
    let selected = ''
    const ret = () => self
    self['select'] = (cols: string) => {
      selected = cols
      return self
    }
    self['eq'] = ret
    self['order'] = ret
    self['limit'] = ret
    self['in'] = (_c: string, ids: string[]) => {
      inIds = ids
      return self
    }
    for (const verb of ['insert', 'update', 'upsert', 'delete']) {
      self[verb] = () => {
        writes.push(`${verb}:${table}`)
        return self
      }
    }
    self['maybeSingle'] = async () => {
      if (table === 'email_templates') {
        return {
          data: {
            subject: 'Plans for {{couple.primary_name}}',
            content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'See attached.' }] }] },
          },
          error: null,
        }
      }
      if (table === 'user_public_settings') {
        return { data: { timezone: 'Australia/Perth', ...(gate.settings ?? {}) }, error: null }
      }
      return { data: null, error: null }
    }
    self['then'] = (resolve: (v: unknown) => unknown) => {
      if (table === 'email_template_files' && inIds) {
        return resolve({ data: inIds.flatMap((id) => (FILES[id] ? [FILES[id]] : [])), error: null })
      }
      if (table === 'email_template_files' && selected === 'id') {
        return resolve({ data: [{ id: FILE_TPL }], error: null })
      }
      if (table === 'couple_contacts') {
        return resolve({
          data: [
            {
              contact: {
                id: 'k1',
                name: 'Bloom Co',
                contact_name: 'Bloom Co',
                email: 'florist@x.test',
                phone: null,
                category: 'Florist',
              },
            },
          ],
          error: null,
        })
      }
      return resolve({ data: [], error: null })
    }
    return self
  }
  return {
    from: (table: string) => {
      reads.push(table)
      return chain(table)
    },
    rpc: async (fn: string) => {
      reads.push(`rpc:${fn}`)
      return { data: false, error: null }
    },
    storage: {
      from: () => ({
        download: async () => ({ data: { arrayBuffer: async () => new ArrayBuffer(2) } }),
      }),
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeClient(),
}))

function makeCtx(overrides: Partial<RunContext['couple'] & object> = {}): RunContext {
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
      event_type: 'new_enquiry',
      payload: {},
      couple_id: 'c1',
      created_at: '2026-09-01T00:00:00Z',
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'c1',
      name: 'Sarah & Jake',
      email: 'sarah@example.com',
      phone: null,
      eventDate: '2026-11-14',
      venue: null,
      status: 'booked',
      primaryName: 'Sarah',
      spouseName: 'Jake',
      spouseEmail: 'jake@example.com',
      spousePhone: null,
      timezone: 'Australia/Sydney',
      ...overrides,
    },
    invoice: null,
    mc: {
      userId: 'u1',
      businessName: 'Golden Mic Co',
      contactName: 'Alex MC',
      email: 'alex@goldenmic.test',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: null,
      signature: null,
      branding: null,
    },
    actionResults: {},
  } as RunContext
}

function step(config: Record<string, unknown>, patch: Partial<WorkflowStepRow> = {}): WorkflowStepRow {
  return {
    id: 's1',
    instance_id: 'i1',
    template_step_id: null,
    position: 0,
    type: 'action',
    config: { actionType: 'send_email', ...config } as never,
    title: 'Plans email',
    description: null,
    timing: DEFAULT_STEP_TIMING,
    due_at: '2026-09-10T08:00:00Z',
    parent_step_id: null,
    branch_path: null,
    status: 'pending',
    requires_approval: true,
    visible_to_couple: false,
    approval_token: null,
    approval_expires_at: null,
    completed_at: null,
    error_message: null,
    output: null,
    attempt_count: 0,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...patch,
  }
}

type Sent = {
  from: string
  to: string
  subject: string
  html: string
  replyTo?: string
  bcc?: string[]
  attachments?: { filename: string }[]
}

async function runSend(config: Record<string, unknown>, ctx = makeCtx()) {
  const spec = getActionSpec('send_email')!
  const parsed = spec.configSchema.safeParse(config)
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  const result = await spec.handler(ctx, parsed.data as never)
  return { result, messages: sendMock.mock.calls.map((c) => c[0] as Sent) }
}

beforeEach(() => {
  _resetWorkflowSendLimitersForTest()
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
  suppressed.clear()
  writes.length = 0
  reads.length = 0
  gate.coupleOptedOut = false
  gate.settings = null
  process.env.RESEND_API_KEY = 'test-key'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the envelope agrees with the send', () => {
  const config = {
    templateId: TEMPLATE_ID,
    recipients: { roles: ['primary', 'spouse'], fallback: 'primary_only' },
    ccVendors: true,
    ccEmails: ['planner@x.test', 'ALEX@goldenmic.test', 'not-an-address'],
    bccEmails: ['aunt@x.test', 'gone@x.test'],
    bccSelf: true,
    replyToOverride: 'bookings@goldenmic.test',
    attachFiles: [FILE_STEP, FILE_TPL],
  }

  it('on recipients, skips, From, reply-to, bcc and attachments', async () => {
    suppressed.add('gone@x.test')
    const { result, messages } = await runSend(config)
    expect(result.kind).toBe('ok')

    const preview = await buildStepPreview(fakeClient() as never, step(config), makeCtx())
    const envelope = preview.envelope!
    expect(envelope).toBeDefined()

    // The same people mailed, in the same order, and nobody else.
    const mailed = envelope.to.filter((r) => r.skipped === null).map((r) => r.email)
    expect(mailed).toEqual(messages.slice(0, -1).map((m) => m.to))
    expect(mailed).toEqual([
      'sarah@example.com',
      'jake@example.com',
      'florist@x.test',
      'planner@x.test',
      'aunt@x.test',
    ])
    // The same people left out, for the send's own reason.
    expect(envelope.to.filter((r) => r.skipped !== null)).toEqual([
      { name: null, email: 'gone@x.test', copy: true, skipped: 'suppressed' },
    ])
    // Split-out cc/bcc addresses are their own messages, marked as such.
    expect(envelope.to.find((r) => r.email === 'florist@x.test')?.copy).toBe(true)
    expect(envelope.to.find((r) => r.email === 'sarah@example.com')?.copy).toBe(false)

    // The MC's own copy is its own last message, and nobody's message
    // carries a bcc (I1).
    const mine = messages.at(-1)!
    expect(mine.to).toBe(envelope.mcCopy)
    expect(envelope.mcCopy).toBe('alex@goldenmic.test')
    for (const m of messages) {
      expect(m.from).toBe(envelope.from)
      expect(m.replyTo).toBe(envelope.replyTo)
      expect(m.bcc).toBeUndefined()
      expect((m.attachments ?? []).map((a) => a.filename)).toEqual(envelope.attachments)
    }
    expect(envelope.attachments).toEqual(['Run sheet.pdf', 'Menu.pdf'])
    expect(envelope.via).toBe('zebri')

    // Reading the envelope wrote nothing.
    expect(writes).toEqual([])
  })

  it('when the couple opted out: their own copies are skipped, the copies still go', async () => {
    gate.coupleOptedOut = true
    const { messages } = await runSend(config)
    const preview = await buildStepPreview(fakeClient() as never, step(config), makeCtx())
    const envelope = preview.envelope!
    expect(envelope.to.filter((r) => r.skipped === null).map((r) => r.email)).toEqual(
      messages.map((m) => m.to),
    )
    expect(envelope.to.filter((r) => r.skipped === 'couple_opted_out').map((r) => r.email)).toEqual([
      'sarah@example.com',
      'jake@example.com',
    ])
    expect(messages.map((m) => m.to)).not.toContain('sarah@example.com')
  })

  const connected = (provider: 'google' | 'microsoft', address: string) => ({
    email_mode: 'oauth',
    oauth_status: 'connected',
    oauth_provider: provider,
    oauth_email: address,
    oauth_from_name: 'Alex Weddings',
    oauth_refresh_token_encrypted: encryptSecret('refresh'),
    oauth_access_token_encrypted: encryptSecret('access'),
    oauth_token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  })

  it('through the MC’s Gmail: the same From header and recipients', async () => {
    gate.settings = connected('google', 'alex@gmail.test')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'g1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const cfg = { subject: 'Hi', body: 'Hello', recipients: { roles: ['primary', 'spouse'], fallback: 'primary_only' } }
    const { result } = await runSend(cfg)
    expect(result.kind).toBe('ok')
    expect(sendMock).not.toHaveBeenCalled()
    const raws = fetchMock.mock.calls.map((c) => {
      const init = (c as unknown as [string, RequestInit])[1]
      return Buffer.from(JSON.parse(String(init.body)).raw, 'base64url').toString('utf8')
    })

    const envelope = (await buildStepPreview(fakeClient() as never, step(cfg), makeCtx())).envelope!
    expect(envelope.via).toBe('gmail')
    expect(envelope.from).toBe('"Alex Weddings" <alex@gmail.test>')
    for (const raw of raws) expect(raw).toContain(`From: ${envelope.from}`)
    const sentTo = raws.map((raw) => /^To: (.+)$/m.exec(raw)?.[1]?.trim())
    expect(sentTo).toEqual(envelope.to.filter((r) => r.skipped === null).map((r) => r.email))
  })

  it('through the MC’s Outlook: sent by Graph from their mailbox, as the envelope says', async () => {
    gate.settings = connected('microsoft', 'alex@outlook.test')
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    const cfg = { subject: 'Hi', body: 'Hello', recipients: { roles: ['primary'], fallback: 'primary_only' } }
    const { result } = await runSend(cfg)
    expect(result.kind).toBe('ok')
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(calls.map((c) => c[0])).toEqual(['https://graph.microsoft.com/v1.0/me/sendMail'])
    const message = JSON.parse(String(calls[0]![1].body)).message

    const envelope = (await buildStepPreview(fakeClient() as never, step(cfg), makeCtx())).envelope!
    // Graph sends as the signed-in mailbox (`/me`), which is the address named.
    expect(envelope.via).toBe('outlook')
    expect(envelope.fromAddress).toBe('alex@outlook.test')
    expect(message.toRecipients.map((r: { emailAddress: { address: string } }) => r.emailAddress.address)).toEqual(
      envelope.to.map((r) => r.email),
    )
    expect(message.replyTo[0].emailAddress.address).toBe(envelope.replyTo)
  })

  it('when the couple has no spouse address, and the fallback applies', async () => {
    const ctx = makeCtx({ spouseEmail: null })
    const cfg = { subject: 'Hi', body: 'Hello', recipients: { roles: ['spouse'], fallback: 'primary_only' } }
    const { messages } = await runSend(cfg, ctx)
    const preview = await buildStepPreview(fakeClient() as never, step(cfg), ctx)
    expect(preview.envelope!.to.map((r) => r.email)).toEqual(messages.map((m) => m.to))
    expect(preview.envelope!.replyTo).toBe('alex@goldenmic.test')
  })

  it('shows a send that would go to nobody as a notice, not an empty line', async () => {
    const ctx = makeCtx({ email: null, spouseEmail: null })
    const cfg = { subject: 'Hi', body: 'Hello', recipients: { roles: ['primary'], fallback: 'skip' } }
    const { result, messages } = await runSend(cfg, ctx)
    expect(messages).toEqual([])
    expect(result).toMatchObject({ kind: 'ok', output: { skipped: 'no recipients' } })
    const preview = await buildStepPreview(fakeClient() as never, step(cfg), ctx)
    expect(preview.envelope!.to).toEqual([])
    expect(preview.envelope!.notice).toMatch(/no one/i)
  })
})

describe('send time', () => {
  const cfg = { subject: 'Hi', body: 'Hello', recipients: { roles: ['primary'], fallback: 'primary_only' } }

  it('reads Now once the step is due', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-11T00:00:00Z'))
    const preview = await buildStepPreview(fakeClient() as never, step(cfg), makeCtx())
    expect(preview.envelope!.sendAt).toEqual({ kind: 'now' })
  })

  it('reads a future due time in the MC’s own timezone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'))
    // 08:00 UTC is 4:00 pm in Perth (the fake settings row's zone).
    const preview = await buildStepPreview(fakeClient() as never, step(cfg), makeCtx())
    const sendAt = preview.envelope!.sendAt
    expect(sendAt?.kind).toBe('at')
    if (sendAt?.kind !== 'at') return
    expect(sendAt.label).toMatch(/Thu,? 10 Sept?, 4:00\s?pm AWST/i)
    expect(sendAt.timeZone).toBe('Australia/Perth')
  })

  it('reads unscheduled while the step before it is still open', async () => {
    const preview = await buildStepPreview(fakeClient() as never, step(cfg, { due_at: null }), makeCtx())
    expect(preview.envelope!.sendAt).toEqual({ kind: 'unscheduled' })
  })

  it('has no send time once the step is done', async () => {
    const preview = await buildStepPreview(fakeClient() as never, step(cfg, { status: 'done' }), makeCtx())
    expect(preview.envelope!.sendAt).toBeNull()
  })

  it('reads held, not waiting on a step, for a send parked on missing details', async () => {
    const parked = step(cfg, { status: 'waiting', due_at: '9999-12-31T00:00:00.000Z' })
    const preview = await buildStepPreview(fakeClient() as never, parked, makeCtx())
    expect(preview.envelope!.sendAt).toEqual({ kind: 'held' })
  })

  for (const status of ['done', 'skipped', 'cancelled'] as const) {
    it(`does not present today's recipients as the ${status} step's`, async () => {
      suppressed.add('sarah@example.com')
      const preview = await buildStepPreview(fakeClient() as never, step(cfg, { status }), makeCtx())
      const envelope = preview.envelope!
      // Who it went to is history; today's opt-outs and contacts would
      // misreport it, so the envelope does not guess.
      expect(envelope.settled).toBe(true)
      expect(envelope.to).toEqual([])
      expect(envelope.mcCopy).toBeNull()
      expect(envelope.notice).toBeTruthy()
    })
  }
})

describe('unresolved variables', () => {
  it('are highlighted in the preview and listed, and never reach the sent HTML (legacy text)', async () => {
    const cfg = {
      subject: 'About {{venue.name}}',
      body: 'We meet at {{venue.name}} soon',
      recipients: { roles: ['primary'], fallback: 'primary_only' },
    }
    const { result, messages } = await runSend(cfg)
    // A legacy text step still sends with the gap blank, as it always has.
    expect(result.kind).toBe('ok')
    const sent = messages[0]!
    expect(sent.html).not.toContain('data-missing-var')
    expect(sent.html).not.toMatch(/[-]/)
    expect(sent.html).toContain('We meet at  soon')
    expect(sent.subject).toBe('About ')

    const preview = await buildStepPreview(fakeClient() as never, step(cfg), makeCtx())
    expect(preview.html).toContain('data-missing-var="true"')
    expect(preview.html).toMatch(/data-missing-var="true"[^>]*>Venue name</)
    expect(preview.html).not.toMatch(/[-]/)
    expect(preview.unresolved).toEqual(['Venue name'])
    expect(preview.envelope!.unresolved).toEqual(['Venue name'])
    // The engine's rule: a legacy text step sends with the gap blank.
    expect(preview.envelope!.unresolvedHolds).toBe(false)
    // The field seed stays the send's subject; the header shows the gap.
    expect(preview.subject).toBe('About ')
    expect(preview.subjectPreview).toBe('About [Venue name]')
  })

  it('are highlighted in a composer body the send refuses to send', async () => {
    const cfg = {
      subject: 'Hi',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'At ' },
              { type: 'mention', attrs: { id: 'venue.name', label: null } },
            ],
          },
        ],
      },
      recipients: { roles: ['primary'], fallback: 'primary_only' },
    }
    const { result, messages } = await runSend(cfg)
    expect(result.kind).toBe('sleep')
    expect(messages).toEqual([])
    const preview = await buildStepPreview(fakeClient() as never, step(cfg), makeCtx())
    expect(preview.html).toMatch(/data-missing-var="true"[^>]*>Venue name</)
    expect(preview.envelope!.unresolved).toEqual(['Venue name'])
    // The engine's rule: a rich-text step parks until the gap is filled.
    expect(preview.envelope!.unresolvedHolds).toBe(true)
  })

  it('leave a fully filled preview byte-identical to the send', async () => {
    const cfg = {
      subject: 'Hi {{couple.primary_name}}',
      body: 'Hello {{couple.primary_name}}',
      recipients: { roles: ['primary'], fallback: 'primary_only' },
    }
    const { messages } = await runSend(cfg)
    const preview = await buildStepPreview(fakeClient() as never, step(cfg), makeCtx())
    expect(preview.html).toBe(messages[0]!.html)
    expect(preview.unresolved).toBeUndefined()
    expect(preview.subjectPreview).toBeUndefined()
  })
})

/** The hidden preheader element of a rendered email, or null. */
function preheaderOf(html: string): string | null {
  return /<div data-zb-preheader="true"[^>]*>[\s\S]*?<\/div>/.exec(html)?.[0] ?? null
}

describe('a gap where the inbox preview is cut (review I1)', () => {
  // 20 five-character words put the gap's label across the ~110
  // character preheader cut, so a preheader derived from the marked text
  // would keep an opening sentinel and lose its closer.
  const body = 'word '.repeat(20) + 'at {{venue.name}} and then more text follows here.'
  const cfg = { subject: 'Hi', body, recipients: { roles: ['primary'], fallback: 'primary_only' } }

  it('keeps the shell intact and the preheader identical to the send’s', async () => {
    const { messages } = await runSend(cfg)
    const sent = messages[0]!.html
    const preview = (await buildStepPreview(fakeClient() as never, step(cfg), makeCtx())).html!

    const tables = (html: string) => (html.match(/<table/g) ?? []).length
    expect(tables(sent)).toBeGreaterThan(0)
    expect(tables(preview)).toBe(tables(sent))
    expect(preview).not.toMatch(/[\uE000-\uE003]/)
    expect(preheaderOf(preview)).toBe(preheaderOf(sent))
    expect(preheaderOf(preview)).not.toContain('data-missing-var')
    // The gap is still marked, in the body where the MC reads it.
    expect(preview).toMatch(/at <span[^>]*data-missing-var="true"[^>]*>Venue name<\/span> and then/)
  })

  it('in a rich-text body too, the preheader carries no highlight markup', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'word '.repeat(20) + 'at ' },
            { type: 'mention', attrs: { id: 'venue.name', label: null } },
            { type: 'text', text: ' and then more text follows here.' },
          ],
        },
      ],
    }
    const source = { kind: 'doc' as const, subject: 'Hi', content }
    const marked = renderSendEmail(source, makeCtx(), true, { highlightMissing: true }).renderHtml(null)
    const plain = renderSendEmail(source, makeCtx(), true).renderHtml(null)
    expect((marked.match(/<table/g) ?? []).length).toBe((plain.match(/<table/g) ?? []).length)
    expect(preheaderOf(marked)).not.toContain('data-missing-var')
    expect(marked).not.toMatch(/[\uE000-\uE003]/)
  })
})

/**
 * An edited preview re-renders on every debounced keystroke burst (Task 29
 * review M5, closed in the Phase 5 fix wave). An edit can only change the
 * unfilled list and, by dropping the template, the attached files, so it
 * re-reads only those: not the sender, the recipients or one suppression
 * RPC per recipient. The rest of the envelope is the saved step's.
 */
describe('an edited preview', () => {
  const config = {
    templateId: TEMPLATE_ID,
    recipients: { roles: ['primary', 'spouse'], fallback: 'primary_only' },
    ccVendors: true,
    attachFiles: [FILE_STEP],
  }
  // Per field since live check B2: a body edit is the editor's TipTap doc.
  const edits = {
    subject: 'New subject',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'We meet at ' },
            { type: 'mention', attrs: { id: 'venue.name', label: null } },
          ],
        },
      ],
    },
  }
  const template = {
    subject: 'Plans for {{couple.primary_name}}',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'See attached.' }] }] },
  }

  it('skips the sender, recipients and suppression reads', async () => {
    const preview = await buildStepPreview(fakeClient() as never, step(config), makeCtx(), edits)
    expect(preview.envelope).toBeUndefined()
    expect(reads).not.toContain('user_public_settings')
    expect(reads).not.toContain('couple_contacts')
    expect(reads.filter((r) => r.startsWith('rpc:'))).toEqual([])
  })

  it('patches exactly what an edit can change, as the full envelope would say it', async () => {
    const edited = await buildStepPreview(fakeClient() as never, step(config), makeCtx(), edits)
    const full = await buildStepPreview(
      fakeClient() as never,
      step(applyReviewEdits(step(config).config, edits, template) as Record<string, unknown>),
      makeCtx(),
    )
    expect(edited.envelopePatch).toEqual({
      attachments: full.envelope!.attachments,
      unresolved: full.envelope!.unresolved,
      unknown: full.envelope!.unknown,
      unresolvedHolds: full.envelope!.unresolvedHolds,
    })
    expect(edited.envelopePatch!.unresolved).toEqual(['Venue name'])
    // The template's own file went with the template.
    expect(edited.envelopePatch!.attachments).toEqual(['Menu.pdf'])
  })
})
