/**
 * Editing a held send keeps it the email it was (Phase 5 live check B2).
 *
 * The step detail modal used to rewrite the whole body from the rendered
 * plain text on ANY edit, a one-letter subject change included: bold,
 * lists, links and the signature were lost, list items fused, and an
 * unfilled variable became an empty string, so a send the rich-text rule
 * held would have gone out with a hole in it. Edits are now per field and
 * a body edit is a TipTap doc from the same editor Compose uses.
 *
 * Every case runs the real `send_email` handler (Resend mocked, nothing
 * leaves) on the config approving would write (`applyReviewEdits`), and
 * checks the preview of the same edits renders the same bytes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetWorkflowSendLimitersForTest } from '@/lib/api/rate-limit'
import { getActionSpec } from '@/lib/automations/actions'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { PREVIEW_UNSUBSCRIBE_URL } from '@/lib/email/send-email-render'
import { applyReviewEdits, buildStepPreview } from '@/lib/workflows/review'
import type { RunContext } from '@/types/automations'
import { DEFAULT_STEP_TIMING, type WorkflowStepRow } from '@/types/workflows'

const sendMock = vi.fn()
const unsubscribeMock = vi.fn()

beforeEach(() => {
  _resetWorkflowSendLimitersForTest()
})

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
  isEmailSuppressed: async () => ({ status: 'clear' }),
  isCoupleOptedOut: async () => ({ status: 'clear' }),
}))

// The send's real link builder mints a signed token. Here it returns the
// preview's placeholder, so the comparison below needs no rewriting.
vi.mock('@/lib/email/automation-send', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    buildUnsubscribeLinks: (...args: unknown[]) => {
      unsubscribeMock(...args)
      return { pageUrl: PREVIEW_UNSUBSCRIBE_URL, oneClickUrl: 'https://app.test/api/unsubscribe/x' }
    },
  }
})

const TEMPLATE_ID = '7f2c1e58-0000-4000-8000-0000000000aa'

/**
 * A saved template, served to both sides: the send reads it through the
 * admin client, the preview through the caller's own client.
 */
const { templateRow } = vi.hoisted(() => ({
  templateRow: {
    subject: 'Template for {{couple.primary_name}}',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'From the ' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'template' },
          ],
        },
      ],
    },
  },
}))

/**
 * A query-builder double that answers every chain the two sides use:
 * `.maybeSingle()` for the template row, and a bare `await` (thenable)
 * for list reads such as the template's files and the sender lookup.
 */
function fakeClient() {
  const chain = (table: string): Record<string, unknown> => {
    const self: Record<string, unknown> = {}
    const ret = () => self
    self['select'] = ret
    self['eq'] = ret
    self['order'] = ret
    self['limit'] = ret
    self['maybeSingle'] = async () => ({
      data: table === 'email_templates' ? templateRow : null,
      error: null,
    })
    self['then'] = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
    return self
  }
  return { from: chain }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeClient(),
}))

/** A branded MC with a signature, so the shell and sign-off are both in play. */
function makeCtx(): RunContext {
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
      spouseEmail: null,
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    invoice: null,
    mc: {
      userId: 'u1',
      businessName: 'Golden Mic Co',
      contactName: 'Alex MC',
      email: 'alex@goldenmic.test',
      phone: null,
      brandColor: '#aa3355',
      logoUrl: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: null,
      signature: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Alex, your MC' }],
          },
        ],
      },
      branding: buildPublicBranding({
        brand_color: '#aa3355',
        business_name: 'Golden Mic Co',
        abn: '12 345 678 901',
      } as never),
    },
    actionResults: {},
  }
}

/** Bold, a bullet list, a link, a couple variable and the signature. */
const richBody = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hi ' },
        { type: 'mention', attrs: { id: 'couple.primary_name', label: null } },
        { type: 'text', text: ', ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'so excited' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Music' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Speeches' }] }] },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [{ type: 'link', attrs: { href: 'https://example.com/plan' } }],
          text: 'our plan',
        },
      ],
    },
    { type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'mc.signature', label: null } }] },
  ],
}

function step(config: Record<string, unknown>): WorkflowStepRow {
  return {
    id: 's1',
    instance_id: 'i1',
    template_step_id: null,
    position: 0,
    type: 'action',
    config: { actionType: 'send_email', ...config } as never,
    title: 'Welcome email',
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
  }
}

/** Run the real handler and return the one message it dispatched. */
async function sent(config: Record<string, unknown>) {
  const spec = getActionSpec('send_email')!
  const parsed = spec.configSchema.safeParse({
    recipients: { roles: ['primary'], fallback: 'primary_only' },
    ...config,
  })
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  const result = await spec.handler(makeCtx(), parsed.data as never)
  expect(result.kind).toBe('ok')
  expect(sendMock).toHaveBeenCalledTimes(1)
  return sendMock.mock.calls[0]![0] as { html: string; subject: string }
}

/** The rich body, plus a sentence with the real venue variable in it. */
function withVenueLine(): Record<string, unknown> {
  const doc = JSON.parse(JSON.stringify(richBody)) as { content: unknown[] }
  doc.content.splice(1, 0, {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'See you at ' },
      { type: 'mention', attrs: { id: 'venue.name', label: null } },
      { type: 'text', text: ', with bells on.' },
    ],
  })
  return doc
}

/** The rich body with one paragraph appended, as the MC typing adds it. */
function withAddedLine(): Record<string, unknown> {
  const doc = JSON.parse(JSON.stringify(richBody)) as { content: unknown[] }
  doc.content.splice(1, 0, { type: 'paragraph', content: [{ type: 'text', text: 'One more thing.' }] })
  return doc
}

/** Run the real handler and return its result, whatever it is. */
async function run(config: Record<string, unknown>, ctx: RunContext = makeCtx()) {
  const spec = getActionSpec('send_email')!
  const parsed = spec.configSchema.safeParse({
    recipients: { roles: ['primary'], fallback: 'primary_only' },
    ...config,
  })
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  return spec.handler(ctx, parsed.data as never)
}

/** Everything a rich send must still carry. */
function expectRich(html: string) {
  expect(html).toContain('<strong>so excited</strong>')
  expect(html).toMatch(/<ul>\s*<li>\s*<p>Music<\/p>\s*<\/li>\s*<li>\s*<p>Speeches<\/p>/)
  expect(html).toContain('href="https://example.com/plan"')
  expect(html).toContain('Alex, your MC')
}

describe('editing a held send in step detail', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    unsubscribeMock.mockClear()
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('a subject-only edit sends the original rich HTML with the new subject', async () => {
    const original = { subject: 'Hello {{couple.primary_name}}', content: richBody }
    const before = await sent(original)
    sendMock.mockClear()

    const edited = applyReviewEdits(step(original).config, { subject: 'Hello again' }, null) as Record<string, unknown>
    // The body is not rewritten at all: the stored doc is the same object shape.
    expect(edited['content']).toEqual(richBody)
    const after = await sent(edited)

    expect(after.subject).toBe('Hello again')
    expect(after.html).toBe(before.html)
    expectRich(after.html)

    // And the preview of that edit is what went out.
    const preview = await buildStepPreview(fakeClient() as never, step(original), makeCtx(), { subject: 'Hello again' })
    expect(preview.html).toBe(after.html)
  })

  it('a subject-only edit on a template step keeps the template body', async () => {
    const original = { templateId: TEMPLATE_ID }
    const before = await sent(original)
    sendMock.mockClear()

    const edited = applyReviewEdits(step(original).config, { subject: 'Just for Sarah' }, templateRow) as Record<string, unknown>
    const after = await sent(edited)
    expect(after.subject).toBe('Just for Sarah')
    expect(after.html).toBe(before.html)
    expect(after.html).toContain('<em>template</em>')
  })

  it('a subject-only edit on a legacy plain-text step leaves its body as it was', async () => {
    const original = { subject: 'Hi', body: 'Plain words for {{couple.primary_name}}' }
    const before = await sent(original)
    sendMock.mockClear()

    const edited = applyReviewEdits(step(original).config, { subject: 'Hi there' }, null) as Record<string, unknown>
    expect(edited['body']).toBe(original.body)
    expect(edited['content']).toBeUndefined()
    const after = await sent(edited)
    expect(after.subject).toBe('Hi there')
    expect(after.html).toBe(before.html)
  })

  it('a rich body edit keeps the bold, the list, the link and the signature', async () => {
    const original = { subject: 'Hello {{couple.primary_name}}', content: richBody }
    const edits = { content: withAddedLine() }
    const message = await sent(applyReviewEdits(step(original).config, edits, null) as Record<string, unknown>)

    expect(message.html).toContain('One more thing.')
    expectRich(message.html)
    // The subject was not touched, so its variable still resolves.
    expect(message.subject).toBe('Hello Sarah')

    const preview = await buildStepPreview(fakeClient() as never, step(original), makeCtx(), edits)
    expect(preview.html).toBe(message.html)
  })

  it('a rich body edit with an unfilled variable still HOLDS the send', async () => {
    const original = { subject: 'Hello {{couple.primary_name}}', content: richBody }
    const edits = { content: withVenueLine() }
    const result = await run(applyReviewEdits(step(original).config, edits, null) as Record<string, unknown>)

    // Parked, not sent with "See you at , with bells on."
    expect(result.kind).toBe('sleep')
    expect(result).toMatchObject({ reason: 'missing_variables', payload: { missing: ['venue.name'] } })
    expect(sendMock).not.toHaveBeenCalled()

    // The preview says the same thing the send does.
    const preview = await buildStepPreview(fakeClient() as never, step(original), makeCtx(), edits)
    expect(preview.unresolved).toEqual(['Venue name'])
    expect(preview.unresolvedHolds).toBe(true)
  })

  it('the same edit sends, rich, once the couple has the detail', async () => {
    const original = { subject: 'Hello {{couple.primary_name}}', content: richBody }
    const ctx = makeCtx()
    ctx.couple = { ...ctx.couple!, venue: 'The Calile' }
    const result = await run(applyReviewEdits(step(original).config, { content: withVenueLine() }, null) as Record<string, unknown>, ctx)
    expect(result.kind).toBe('ok')
    const message = sendMock.mock.calls[0]![0] as { html: string }
    expect(message.html).toContain('See you at The Calile, with bells on.')
    expectRich(message.html)
  })
})
