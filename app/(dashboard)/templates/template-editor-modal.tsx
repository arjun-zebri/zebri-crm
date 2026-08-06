/**
 * Create / edit modal for an email template.
 *
 * Left: name, stage, subject (with variable insertion) and the TipTap
 * body editor wired to the email variable catalogue. Right: a live
 * preview filled with sample data so the MC sees the finished email as
 * they author it.
 *
 * @module app/(dashboard)/templates/template-editor-modal
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { Monitor, Send, Smartphone } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useToast } from '@/components/ui/toast'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { EMAIL_TEMPLATE_VARIABLES, buildSampleContext } from '@/lib/email/template-variables'
import type { EmailTemplate } from '@/types/email-template'

import { deleteTemplateFileAction, linkTemplateFilesAction } from './attachment-actions'
import { CategoryPicker } from './category-picker'
import { EmailAppearancePopover, useEmailShellPrefs } from './email-appearance'
import { SubjectField } from './subject-field'
import { TemplateAttachments } from './template-attachments'
import { TemplatePreview } from './template-preview'
import { sendTestTemplateEmailAction } from './test-send-action'
import { useCreateTemplate, useUpdateTemplate } from './use-templates'

const EMPTY_BODY: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

interface TemplateEditorModalProps {
  isOpen: boolean
  onClose: () => void
  template: EmailTemplate | null
  businessName?: string | undefined
  contactName?: string | undefined
  /** The MC's real email, so `{{mc.email}}` previews truthfully. */
  email?: string | undefined
  /** The MC's saved signature, so `{{mc.signature}}` previews as sent. */
  emailSignature?: JSONContent | null | undefined
  /** Resolved branding for the WYSIWYG shell preview. */
  branding?: PublicBranding | null | undefined
}

export function TemplateEditorModal({
  isOpen,
  onClose,
  template,
  businessName,
  contactName,
  email,
  emailSignature,
  branding,
}: TemplateEditorModalProps) {
  const { toast } = useToast()
  const create = useCreateTemplate()
  const update = useUpdateTemplate()

  const [name, setName] = useState(template?.name ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(template?.category_id ?? null)
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [content, setContent] = useState<JSONContent>(template?.content ?? EMPTY_BODY)

  // Shell appearance (logo / alignment / accent bar) — persisted to
  // user_metadata so it applies to real sends; merged over the branding
  // here so the preview updates the moment a switch flips.
  const { prefs, setPrefs } = useEmailShellPrefs(branding)
  const effectiveBranding = useMemo(
    () =>
      branding
        ? {
            ...branding,
            email_show_logo: prefs.showLogo,
            email_logo_align: prefs.logoAlign,
            email_show_accent: prefs.showAccent,
          }
        : branding,
    [branding, prefs],
  )

  const ctx = useMemo(
    () =>
      buildSampleContext({
        businessName,
        contactName,
        email,
        signature: emailSignature,
        branding: effectiveBranding,
      }),
    [businessName, contactName, email, emailSignature, effectiveBranding],
  )
  const saving = create.isPending || update.isPending
  const [testSending, setTestSending] = useState(false)
  // Preview viewport: desktop-width shell or a centred 375px phone frame.
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')

  // Draft attachments uploaded before the first save (template === null):
  // linked to the new template on save, deleted if the draft is
  // discarded. A ref (not state) — nothing renders from it here.
  const pendingFileIdsRef = useRef<string[]>([])

  const close = () => {
    // Discarding an unsaved draft: clean up its parked uploads so they
    // don't accumulate invisibly (best-effort; failures are harmless
    // orphans with no UI surface).
    if (!template && pendingFileIdsRef.current.length > 0) {
      for (const id of pendingFileIdsRef.current) void deleteTemplateFileAction(id)
      pendingFileIdsRef.current = []
    }
    onClose()
  }

  // Emails the live draft (no save needed) to the MC's own inbox with
  // sample data filled — the fastest way to sanity-check a real client.
  const sendTest = async () => {
    setTestSending(true)
    try {
      const res = await sendTestTemplateEmailAction({
        subject,
        content: content as Record<string, unknown>,
      })
      if (res.ok) toast(`Test sent to ${res.data.to}`, 'success')
      else toast(res.error, 'error')
    } catch {
      toast('Could not send the test email', 'error')
    } finally {
      setTestSending(false)
    }
  }

  const save = async () => {
    if (!name.trim()) {
      toast('Give your template a name', 'error')
      return
    }
    const input = {
      name,
      description: '',
      subject,
      content: content as Record<string, unknown>,
      category_id: categoryId,
    }
    try {
      if (template) {
        await update.mutateAsync({ id: template.id, input })
      } else {
        const created = await create.mutateAsync(input)
        // Adopt any draft attachments uploaded before this first save.
        if (pendingFileIdsRef.current.length > 0) {
          const linked = await linkTemplateFilesAction(created.id, pendingFileIdsRef.current)
          if (!linked.ok) toast('Template saved, but attachments could not be linked', 'error')
          pendingFileIdsRef.current = []
        }
      }
      toast(template ? 'Template saved' : 'Template created', 'success')
      onClose()
    } catch {
      toast('Could not save template', 'error')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="fullscreen"
      title={template ? 'Edit template' : 'New template'}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={sendTest} loading={testSending} className="gap-1.5">
            <Send size={14} strokeWidth={1.5} />
            Send test to myself
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              Save template
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 overflow-y-auto">
          {/* Name + category share a row — name takes the slack, the
              category picker sits compact beside it. Stacks on narrow
              viewports. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              className="sm:col-span-2"
              label="Template name"
              size="sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quote follow-up"
            />
            <CategoryPicker value={categoryId} onChange={setCategoryId} />
          </div>
          <SubjectField value={subject} onChange={setSubject} />
          <div>
            <p className="mb-1 text-caption font-medium text-text">Body</p>
            <RichTextEditor
              value={content}
              onChange={setContent}
              variables={EMAIL_TEMPLATE_VARIABLES}
              dense
              placeholder="Write your message. Type @ to fill in the couple's name, wedding date, links and more."
            />
          </div>
          <TemplateAttachments
            templateId={template?.id ?? null}
            onPendingChange={(ids) => {
              pendingFileIdsRef.current = ids
            }}
          />
        </div>
        <div className="flex min-h-0 flex-col overflow-y-auto lg:overflow-visible">
          <div className="mb-1 flex shrink-0 items-center justify-between">
            <p className="text-caption font-medium text-text">Preview</p>
            <div className="flex items-center gap-1">
            <EmailAppearancePopover prefs={prefs} onChange={setPrefs} />
            {/* Same segmented device toggle as the branding editor. */}
            <div className="flex items-center rounded-control bg-surface-muted p-0.5">
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                aria-label="Desktop preview"
                title="Desktop"
                className={`inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-control transition ${
                  device === 'desktop' ? 'bg-card text-text shadow-sm' : 'text-text-subtle hover:text-text'
                }`}
              >
                <Monitor size={13} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setDevice('mobile')}
                aria-label="Mobile preview"
                title="Mobile"
                className={`inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-control transition ${
                  device === 'mobile' ? 'bg-card text-text shadow-sm' : 'text-text-subtle hover:text-text'
                }`}
              >
                <Smartphone size={13} strokeWidth={1.5} />
              </button>
            </div>
            </div>
          </div>
          <p className="mb-2 shrink-0 text-caption text-text-subtle">Filled with example data so you can see the finished email.</p>
          {/* Desktop: exactly the pane's remaining height, so the outer
              column never scrolls. Stacked mobile: a fixed height keeps
              the iframe from collapsing in the auto-height column. */}
          <div className="h-[65vh] lg:h-auto lg:min-h-0 lg:flex-1">
            <TemplatePreview subject={subject} content={content} ctx={ctx} shell device={device} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
