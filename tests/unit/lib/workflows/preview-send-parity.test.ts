/**
 * The review preview IS the send (Task 28, Phase 5 exit criterion).
 *
 * "What the MC reads before approving is what the couple receives,
 * including branding and signature." The only way to hold that is to
 * render both from one function and compare the bytes: the real
 * `send_email` handler dispatches a message (captured off the mocked
 * Resend client), `buildStepPreview` renders the same step against the
 * same context, and the two HTML strings must be identical.
 *
 * The unsubscribe link is the one thing that legitimately differs: a
 * send mints a per-recipient token, a preview must never mint one. The
 * link builder is mocked here to hand the send the preview's own inert
 * placeholder, so every other byte is compared as-is.
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

async function previewed(config: Record<string, unknown>) {
  const preview = await buildStepPreview(fakeClient() as never, step(config), makeCtx())
  expect(preview.kind).toBe('email')
  return preview
}

describe('the review preview is byte-identical to the send', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    unsubscribeMock.mockClear()
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('for a composer body with bold, a list, a link, branding and the signature', async () => {
    const config = { subject: 'Hello {{couple.primary_name}}', content: richBody }
    const message = await sent(config)
    const preview = await previewed(config)

    expect(preview.html).toBe(message.html)
    expect(preview.subject).toBe(message.subject)

    // Guard against both sides agreeing on an empty or broken render.
    expect(message.html).toContain('<strong>so excited</strong>')
    expect(message.html).toMatch(/<ul>\s*<li>/)
    expect(message.html).toContain('href="https://example.com/plan"')
    expect(message.html).toContain('Alex, your MC')
    expect(message.html).toContain('#aa3355')
    expect(message.html).toContain(PREVIEW_UNSUBSCRIBE_URL)
    expect(message.subject).toBe('Hello Sarah')
  })

  it('for a step that sends a saved template', async () => {
    const config = { templateId: TEMPLATE_ID }
    const message = await sent(config)
    const preview = await previewed(config)
    expect(preview.html).toBe(message.html)
    expect(preview.subject).toBe(message.subject)
    expect(message.html).toContain('<em>template</em>')
  })

  it('for a pre-composer plain-text body', async () => {
    const config = { subject: 'Hi', body: 'Plain words for {{couple.primary_name}}' }
    const message = await sent(config)
    const preview = await previewed(config)
    expect(preview.html).toBe(message.html)
    expect(message.html).toContain('Plain words for Sarah')
  })

  it('for an unwrapped body, which gets the compliance footer appended', async () => {
    const config = { subject: 'Hi', content: richBody, wrap: false }
    const message = await sent(config)
    const preview = await previewed(config)
    expect(preview.html).toBe(message.html)
    expect(message.html).toContain(PREVIEW_UNSUBSCRIBE_URL)
  })
  it('for the MC\'s pending edits, exactly as approving them would send', async () => {
    const original = { subject: 'Hi', content: richBody }
    // Per field since live check B2: the body is the editor's own doc.
    const edits = {
      subject: 'Edited subject',
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'New first line' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second line' }] },
        ],
      },
    }
    const message = await sent(applyReviewEdits(original as never, edits, null) as Record<string, unknown>)
    const preview = await buildStepPreview(fakeClient() as never, step(original), makeCtx(), edits)
    expect(preview.html).toBe(message.html)
    expect(preview.subject).toBe('Edited subject')
    expect(message.html).toContain('New first line')
    expect(message.html).not.toContain('so excited')
  })
})

describe('rendering a preview has no side effects', () => {
  beforeEach(() => {
    sendMock.mockReset()
    unsubscribeMock.mockClear()
  })

  it('mints no unsubscribe link and dispatches nothing', async () => {
    const preview = await previewed({ subject: 'Hi', content: richBody })
    // The placeholder, never a signed per-recipient token.
    expect(preview.html).toContain(PREVIEW_UNSUBSCRIBE_URL)
    expect(unsubscribeMock).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

})
