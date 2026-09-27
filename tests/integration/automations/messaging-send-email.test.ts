/**
 * Integration tests for the `send_email` automation action: template
 * attachments, and the opt-out gate in front of every dispatch.
 *
 * The attachment cases prove that a send_email step referencing a saved
 * email template picks up the files linked to it, deduplicated against
 * anything also listed in attachFiles.
 *
 * The opt-out cases are the ones a person's legal exposure rests on.
 * They run against the real local database, the real
 * `email_suppression` table with its `lower(email)` unique index, the
 * real `is_email_suppressed` function and the real executor, and they
 * assert on the TRANSPORT rather than on the action result: a result
 * that says "skipped" says nothing about whether the provider was
 * reached.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

let activeUser: TestUser | null = null

// Only the transport call is replaced: the module's constants (the tags
// the send path sets) and pure helpers stay real.
vi.mock('@/lib/email/dispatch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/dispatch')>()),
  dispatchEmail: vi.fn(),
}))

/**
 * Address whose suppression lookup is forced to report `unknown`, the
 * "could not determine" outcome. Null for every other test in this file,
 * which therefore goes through the real database function against the
 * real table.
 *
 * Forcing it at this seam rather than in Postgres is deliberate: the
 * only ways to make the real lookup error are to drop the function or
 * revoke its grants, and this local database is shared with other
 * worktrees and other test files running at the same time. What is under
 * test here is the CALLER's handling of an indeterminate answer, and the
 * assertions below still run through the real executor, the real step
 * rows and the real retry bookkeeping.
 */
let suppressionLookupFailsFor: string | null = null

vi.mock('@/lib/email/suppression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/suppression')>()
  return {
    ...actual,
    isEmailSuppressed: async (
      supabase: Parameters<typeof actual.isEmailSuppressed>[0],
      userId: string,
      email: string,
    ): Promise<import('@/lib/email/suppression').SendGateResult> => {
      if (
        suppressionLookupFailsFor &&
        email.toLowerCase() === suppressionLookupFailsFor.toLowerCase()
      ) {
        return { status: 'unknown', reason: 'forced lookup failure' }
      }
      return actual.isEmailSuppressed(supabase, userId, email)
    },
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user: set `activeUser` first')
    return activeUser.client
  }),
}))

vi.mock('@/lib/email/send-context', async () => {
  const actual = await vi.importActual<typeof import('@/lib/email/send-context')>(
    '@/lib/email/send-context',
  )
  return {
    ...actual,
    downloadStaticAttachments: vi.fn(async (supabase: any, fileIds: string[]) => {
      // Mock the download to return attachment data with real filenames
      // queried from the database. In a real scenario, files would be
      // downloaded from storage, but for testing we use mock buffers.
      if (fileIds.length === 0) return []
      const { data: rows } = await supabase
        .from('email_template_files')
        .select('file_name')
        .in('id', fileIds)
      if (!rows?.length) return []

      return rows.map((row: { file_name: string }) => ({
        filename: row.file_name,
        content: Buffer.from(`Mock PDF content for ${row.file_name}`),
      }))
    }),
  }
})

import { dispatchEmail } from '@/lib/email/dispatch'
import { advanceDueSteps } from '@/lib/workflows/executor'
import { applyTemplate } from '@/lib/workflows/instantiate'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'
import { seedEventTemplate } from '../helpers/workflows'

const dispatchEmailMock = dispatchEmail as any

/**
 * Seed a couple, email template with linked file metadata, and an
 * automation with a send_email action referencing the template.
 */
async function seed(
  user: TestUser,
): Promise<{
  coupleId: string
  workflowTemplateId: string
  templateId: string
  fileId: string
}> {
  const svc = serviceClient()

  // Create couple
  const { data: couple, error: cErr } = await svc
    .from('couples')
    .insert({
      user_id: user.id,
      name: 'Template email couple',
      status: 'enquiry',
      email: 'couple@example.com',
      kanban_position: 0,
    } as never)
    .select('id')
    .single()
  if (cErr) throw new Error(cErr.message)
  const coupleId = (couple as { id: string }).id

  // Create email template
  const { data: tpl, error: tErr } = await svc
    .from('email_templates')
    .insert({
      user_id: user.id,
      name: 'Template with attachments',
      subject: 'Hello {{couple.primary_name}}',
      content: { type: 'doc', content: [] },
      lifecycle_stage: 'enquiry',
    } as never)
    .select('id')
    .single()
  if (tErr) throw new Error(tErr.message)
  const templateId = (tpl as { id: string }).id

  // Create email_template_files metadata (file record linking to the template).
  // This represents a file that was uploaded to the storage bucket at
  // `email-template-files/{user_id}/{template_id}/{fileId}`.
  const { data: file, error: fErr } = await svc
    .from('email_template_files')
    .insert({
      user_id: user.id,
      template_id: templateId,
      file_name: 'proposal.pdf',
      file_size: 12345,
      mime_type: 'application/pdf',
      storage_path: `${user.id}/${templateId}/proposal.pdf`,
    } as never)
    .select('id')
    .single()
  if (fErr) throw new Error(fErr.message)
  const fileId = (file as { id: string }).id

  // A workflow template whose single step sends the email. The step is
  // the head of its lane with `after_previous` timing, so applying the
  // template makes it immediately due and the next executor pass runs it.
  const { data: auto, error: aErr } = await svc
    .from('workflow_templates')
    .insert({
      user_id: user.id,
      name: 'Send template with attachment',
      apply_rule_type: 'manual',
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (aErr) throw new Error(aErr.message)
  const workflowTemplateId = (auto as { id: string }).id

  const { error: actErr } = await svc.from('workflow_template_steps').insert({
    template_id: workflowTemplateId,
    type: 'action',
    position: 0,
    parent_step_id: null,
    config: {
      actionType: 'send_email',
      recipients: { roles: ['primary'], fallback: 'primary_only' },
      templateId,
    },
  } as never)
  if (actErr) throw new Error(actErr.message)

  return { coupleId, workflowTemplateId, templateId, fileId }
}

/**
 * A couple plus an active workflow template whose single step sends an
 * inline email to that couple.
 *
 * Every write destructures `error` and throws on it. The previous
 * version of these tests hand-rolled a `workflow_templates` insert with
 * columns the table does not have and discarded the error, so the seed
 * wrote nothing and the failure only surfaced three statements later as
 * a null dereference. `seedEventTemplate` is the shared helper that
 * writes the real columns; `applyTemplate` only requires the template to
 * exist, be owned and not be archived, so its `on_event` apply rule is
 * applied by hand here exactly as a manual one would be.
 */
async function seedInlineSendEmail(
  user: TestUser,
  couple: { email: string; doNotEmail?: boolean },
  recipients: { roles: string[]; fallback: string } = {
    roles: ['primary'],
    fallback: 'primary_only',
  },
): Promise<{ coupleId: string; templateId: string }> {
  const svc = serviceClient()

  const { data: coupleRow, error: coupleErr } = await svc
    .from('couples')
    .insert({
      user_id: user.id,
      name: 'Opt-out test couple',
      status: 'booked',
      email: couple.email,
      kanban_position: 0,
      do_not_email: couple.doNotEmail ?? false,
    } as never)
    .select('id')
    .single()
  if (coupleErr || !coupleRow) throw new Error(`seed couple: ${coupleErr?.message}`)

  const templateId = await seedEventTemplate(user.id, 'couple.created')

  const { error: stepErr } = await svc.from('workflow_template_steps').insert({
    template_id: templateId,
    type: 'action',
    position: 0,
    parent_step_id: null,
    config: {
      actionType: 'send_email',
      recipients,
      subject: 'Test',
      body: 'Test body',
    },
  } as never)
  if (stepErr) throw new Error(`seed step: ${stepErr.message}`)

  return { coupleId: (coupleRow as { id: string }).id, templateId }
}

/** One suppression row, written as typed rather than lower-cased. */
async function seedSuppression(userId: string, email: string): Promise<void> {
  const { error } = await serviceClient()
    .from('email_suppression')
    .insert({ user_id: userId, email, reason: 'unsubscribed' } as never)
  if (error) throw new Error(`seed suppression: ${error.message}`)
}

/**
 * Record every payload that reaches the transport. The assertions below
 * check THIS, not the action result: a result that says "skipped" says
 * nothing about whether the provider was reached.
 */
function captureDispatches(): unknown[] {
  const captured: unknown[] = []
  dispatchEmailMock.mockImplementation((_sender: unknown, payload: unknown) => {
    captured.push(payload)
    return { ok: true, messageId: 'test-msg-id' }
  })
  return captured
}

/** The single step row of the single instance applied from a template. */
async function onlyStep(templateId: string): Promise<{
  status: string
  attempt_count: number
  error_message: string | null
  due_at: string | null
  output: unknown
}> {
  const svc = serviceClient()
  const { data: instances, error: instErr } = await svc
    .from('workflow_instances')
    .select('id')
    .eq('template_id', templateId)
  if (instErr) throw new Error(`read instances: ${instErr.message}`)
  if (instances?.length !== 1) {
    throw new Error(`expected exactly one instance, got ${instances?.length ?? 0}`)
  }

  const { data: steps, error: stepErr } = await svc
    .from('workflow_steps')
    .select('status, attempt_count, error_message, due_at, output')
    .eq('instance_id', instances[0]!.id)
  if (stepErr) throw new Error(`read steps: ${stepErr.message}`)
  if (steps?.length !== 1) {
    throw new Error(`expected exactly one step, got ${steps?.length ?? 0}`)
  }
  return steps[0]!
}

afterEach(() => {
  activeUser = null
  suppressionLookupFailsFor = null
  dispatchEmailMock.mockReset()
})

describe('send_email automation action', () => {
  it('fetches and includes template-linked files as attachments', async () => {
    const user = await createTestUser()
    const svc = serviceClient()
    const { coupleId, workflowTemplateId } = await seed(user)

    // Mock dispatchEmail to capture the email payload and return success.
    // Store all calls so we can inspect what was sent to the couple.
    const capturedPayloads: unknown[] = []
    dispatchEmailMock.mockImplementation((sender: unknown, payload: unknown) => {
      capturedPayloads.push(payload)
      return { ok: true, messageId: 'test-msg-id' }
    })

    activeUser = user
    const applied = await applyTemplate(svc, {
      userId: user.id,
      templateId: workflowTemplateId,
      coupleId,
    })
    expect(applied).toHaveProperty('instanceId')
    await advanceDueSteps(svc)

    // Verify dispatchEmail was called at least once (could be test + real, or just real).
    expect(dispatchEmailMock).toHaveBeenCalled()

    // Find the real send (to the couple, not a test send to the MC).
    const realSend = capturedPayloads.find(
      (p: any) => p.to === 'couple@example.com',
    )
    expect(realSend).toBeDefined()

    // Core assertion: attachments array exists and contains the template file.
    const realSendPayload = realSend as any
    expect(realSendPayload.attachments).toBeDefined()
    expect(realSendPayload.attachments).toBeInstanceOf(Array)
    expect(realSendPayload.attachments.length).toBeGreaterThan(0)

    // The attachment should be the template file (proposal.pdf).
    const attachment = realSendPayload.attachments[0]
    expect(attachment.filename).toBe('proposal.pdf')
    expect(attachment.content).toBeDefined()
    expect(attachment.content).toBeInstanceOf(Buffer)

    await user.cleanup()
  })

  it('deduplicates files attached both in template and attachFiles config', async () => {
    const user = await createTestUser()
    const svc = serviceClient()

    // Seed a couple, template, and file
    const { data: couple, error: cErr } = await svc
      .from('couples')
      .insert({
        user_id: user.id,
        name: 'Dedupe test couple',
        status: 'enquiry',
        email: 'couple@example.com',
        kanban_position: 0,
      } as never)
      .select('id')
      .single()
    if (cErr) throw new Error(cErr.message)
    const coupleId = (couple as { id: string }).id

    const { data: tpl, error: tErr } = await svc
      .from('email_templates')
      .insert({
        user_id: user.id,
        name: 'Template with file for dedupe',
        subject: 'Dedupe test',
        content: { type: 'doc', content: [] },
        lifecycle_stage: 'enquiry',
      } as never)
      .select('id')
      .single()
    if (tErr) throw new Error(tErr.message)
    const templateId = (tpl as { id: string }).id

    // Create a file that will be linked to the template
    const { data: file, error: fErr } = await svc
      .from('email_template_files')
      .insert({
        user_id: user.id,
        template_id: templateId,
        file_name: 'shared.pdf',
        file_size: 54321,
        mime_type: 'application/pdf',
        storage_path: `${user.id}/${templateId}/shared.pdf`,
      } as never)
      .select('id')
      .single()
    if (fErr) throw new Error(fErr.message)
    const fileId = (file as { id: string }).id

    // A workflow template whose send_email step references both the
    // template (which contains the file) and explicitly lists the same
    // file in attachFiles. The deduplication should ensure it appears
    // only once in the final attachments array.
    const { data: auto, error: aErr } = await svc
      .from('workflow_templates')
      .insert({
        user_id: user.id,
        name: 'Dedupe send',
        apply_rule_type: 'manual',
        status: 'active',
      } as never)
      .select('id')
      .single()
    if (aErr) throw new Error(aErr.message)
    const workflowTemplateId = (auto as { id: string }).id

    const { error: actErr } = await svc.from('workflow_template_steps').insert({
      template_id: workflowTemplateId,
      type: 'action',
      position: 0,
      parent_step_id: null,
      config: {
        actionType: 'send_email',
        recipients: { roles: ['primary'], fallback: 'primary_only' },
        templateId,
        attachFiles: [fileId], // Same file, also in attachFiles
      },
    } as never)
    if (actErr) throw new Error(actErr.message)

    // Mock and run
    const capturedPayloads: unknown[] = []
    dispatchEmailMock.mockImplementation((sender: unknown, payload: unknown) => {
      capturedPayloads.push(payload)
      return { ok: true, messageId: 'dedupe-msg-id' }
    })

    activeUser = user
    const applied = await applyTemplate(svc, {
      userId: user.id,
      templateId: workflowTemplateId,
      coupleId,
    })
    expect(applied).toHaveProperty('instanceId')
    await advanceDueSteps(svc)

    // Find the real send to the couple
    const realSend = capturedPayloads.find(
      (p: any) => p.to === 'couple@example.com',
    ) as any
    expect(realSend).toBeDefined()

    // Assertion: the file should appear exactly once, not twice
    expect(realSend.attachments).toBeDefined()
    const attachmentNames = (realSend.attachments ?? []).map(
      (a: any) => a.filename,
    )
    expect(attachmentNames).toEqual(['shared.pdf'])
    expect(attachmentNames.filter((n: string) => n === 'shared.pdf')).toHaveLength(1)

    await user.cleanup()
  })

  it('never dispatches to an address on the suppression list', async () => {
    const user = await createTestUser()
    const { coupleId, templateId } = await seedInlineSendEmail(user, {
      email: 'suppressed@example.com',
    })
    await seedSuppression(user.id, 'suppressed@example.com')

    const captured = captureDispatches()

    activeUser = user
    await applyTemplate(serviceClient(), { userId: user.id, templateId, coupleId })
    await advanceDueSteps(serviceClient())

    // The transport, not the result: a result that says "skipped" proves
    // nothing about whether the provider was reached.
    expect(captured).toHaveLength(0)
    const step = await onlyStep(templateId)
    expect(step.status).toBe('done')
    expect((step.output as { suppressed?: number } | null)?.suppressed).toBe(1)

    await user.cleanup()
  })

  it('never dispatches to a couple flagged do_not_email', async () => {
    const user = await createTestUser()
    const { coupleId, templateId } = await seedInlineSendEmail(user, {
      email: 'optedout@example.com',
      doNotEmail: true,
    })

    const captured = captureDispatches()

    activeUser = user
    await applyTemplate(serviceClient(), { userId: user.id, templateId, coupleId })
    await advanceDueSteps(serviceClient())

    expect(captured).toHaveLength(0)
    const step = await onlyStep(templateId)
    expect(step.status).toBe('done')

    await user.cleanup()
  })

  // Both directions matter. A naive `email.toLowerCase()` on the search
  // term would pass the second of these and fail the first, so only the
  // pair pins the behaviour the unique index implies.
  it('matches a mixed-case stored address against a lowercase send', async () => {
    const user = await createTestUser()
    const { coupleId, templateId } = await seedInlineSendEmail(user, {
      email: 'sarah@example.com',
    })
    await seedSuppression(user.id, 'Sarah@Example.com')

    const captured = captureDispatches()

    activeUser = user
    await applyTemplate(serviceClient(), { userId: user.id, templateId, coupleId })
    await advanceDueSteps(serviceClient())

    expect(captured).toHaveLength(0)

    await user.cleanup()
  })

  it('matches a lowercase stored address against a mixed-case send', async () => {
    const user = await createTestUser()
    const { coupleId, templateId } = await seedInlineSendEmail(user, {
      email: 'Sarah@Example.com',
    })
    await seedSuppression(user.id, 'sarah@example.com')

    const captured = captureDispatches()

    activeUser = user
    await applyTemplate(serviceClient(), { userId: user.id, templateId, coupleId })
    await advanceDueSteps(serviceClient())

    expect(captured).toHaveLength(0)

    await user.cleanup()
  })

  it('defers the step when the suppression lookup cannot be completed', async () => {
    const user = await createTestUser()
    const { coupleId, templateId } = await seedInlineSendEmail(user, {
      email: 'unknown-state@example.com',
    })
    suppressionLookupFailsFor = 'unknown-state@example.com'

    const captured = captureDispatches()

    activeUser = user
    await applyTemplate(serviceClient(), { userId: user.id, templateId, coupleId })
    await advanceDueSteps(serviceClient())

    // Neither of the two wrong answers: nothing was sent to a person who
    // may have unsubscribed, and nothing was written off as a deliberate
    // skip that will never be retried.
    expect(captured).toHaveLength(0)
    const step = await onlyStep(templateId)
    expect(step.status).toBe('pending')
    expect(step.attempt_count).toBe(1)
    expect(step.error_message).toContain('suppression')
    expect(new Date(step.due_at as string).getTime()).toBeGreaterThan(Date.now())

    await user.cleanup()
  })

  it('sends to the one clear recipient when the other is suppressed', async () => {
    const user = await createTestUser()
    const svc = serviceClient()
    const { coupleId, templateId } = await seedInlineSendEmail(
      user,
      { email: 'clear@example.com' },
      { roles: ['primary', 'spouse'], fallback: 'primary_only' },
    )
    const { error: spouseErr } = await svc
      .from('couples')
      .update({ secondary_name: 'Sam', secondary_email: 'blocked@example.com' })
      .eq('id', coupleId)
    if (spouseErr) throw new Error(`seed spouse: ${spouseErr.message}`)
    await seedSuppression(user.id, 'blocked@example.com')

    const captured = captureDispatches()

    activeUser = user
    await applyTemplate(svc, { userId: user.id, templateId, coupleId })
    await advanceDueSteps(svc)

    expect(captured.map((p) => (p as { to: string }).to)).toEqual(['clear@example.com'])
    const step = await onlyStep(templateId)
    const output = step.output as { sent?: number; suppressed?: number } | null
    expect(output?.sent).toBe(1)
    expect(output?.suppressed).toBe(1)

    await user.cleanup()
  })
})
