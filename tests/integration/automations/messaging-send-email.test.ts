/**
 * Integration tests for `send_email` automation action with template
 * attachments.
 *
 * Proves that when a send_email action references a saved email template,
 * the automation handler fetches and includes any files linked to that
 * template via email_template_files, alongside any explicitly configured
 * attachFiles. Deduplication by file id ensures a file attached both
 * ways sends once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

let activeUser: TestUser | null = null

vi.mock('@/lib/email/dispatch', () => ({
  dispatchEmail: vi.fn(),
}))

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

import { runAutomationForCoupleAction } from '@/app/(dashboard)/automations/actions'
import { dispatchEmail } from '@/lib/email/dispatch'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

const dispatchEmailMock = dispatchEmail as any

/**
 * Seed a couple, email template with linked file metadata, and an
 * automation with a send_email action referencing the template.
 */
async function seed(
  user: TestUser,
): Promise<{
  coupleId: string
  automationId: string
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

  // Create automation with send_email action referencing the template.
  const { data: auto, error: aErr } = await svc
    .from('automations')
    .insert({
      user_id: user.id,
      name: 'Send template with attachment',
      trigger_type: 'manual_fire',
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (aErr) throw new Error(aErr.message)
  const automationId = (auto as { id: string }).id

  const { error: actErr } = await svc.from('automation_actions').insert({
    automation_id: automationId,
    type: 'send_email',
    position: 0,
    parent_action_id: null,
    config: {
      recipients: { roles: ['primary'], fallback: 'primary_only' },
      templateId,
    },
  } as never)
  if (actErr) throw new Error(actErr.message)

  return { coupleId, automationId, templateId, fileId }
}

afterEach(() => {
  activeUser = null
  dispatchEmailMock.mockReset()
})

describe('send_email automation action with template attachments', () => {
  it('fetches and includes template-linked files as attachments', async () => {
    const user = await createTestUser()
    const { coupleId, automationId } = await seed(user)

    // Mock dispatchEmail to capture the email payload and return success.
    // Store all calls so we can inspect what was sent to the couple.
    const capturedPayloads: unknown[] = []
    dispatchEmailMock.mockImplementation((sender: unknown, payload: unknown) => {
      capturedPayloads.push(payload)
      return { ok: true, messageId: 'test-msg-id' }
    })

    activeUser = user
    const res = await runAutomationForCoupleAction({ automationId, coupleId })
    expect(res.ok).toBe(true)

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

    // Create automation with send_email action that references both the
    // template (which contains the file) and explicitly lists the same
    // file in attachFiles. The deduplication should ensure it appears
    // only once in the final attachments array.
    const { data: auto, error: aErr } = await svc
      .from('automations')
      .insert({
        user_id: user.id,
        name: 'Dedupe send',
        trigger_type: 'manual_fire',
        status: 'active',
      } as never)
      .select('id')
      .single()
    if (aErr) throw new Error(aErr.message)
    const automationId = (auto as { id: string }).id

    const { error: actErr } = await svc.from('automation_actions').insert({
      automation_id: automationId,
      type: 'send_email',
      position: 0,
      parent_action_id: null,
      config: {
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
    const res = await runAutomationForCoupleAction({ automationId, coupleId })
    expect(res.ok).toBe(true)

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
})
