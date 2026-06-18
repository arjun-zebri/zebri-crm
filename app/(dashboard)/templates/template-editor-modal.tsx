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
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { EMAIL_TEMPLATE_VARIABLES, buildSampleContext } from '@/lib/email/template-variables'
import { LIFECYCLE_LABELS, LIFECYCLE_STAGES, type EmailTemplate } from '@/types/email-template'

import { SubjectField } from './subject-field'
import { TemplatePreview } from './template-preview'
import { useCreateTemplate, useUpdateTemplate } from './use-templates'

const EMPTY_BODY: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

// Radix Select forbids an empty-string item value, so "No stage" uses
// a sentinel that maps back to null/'' on save.
const NO_STAGE = '__none__'
const STAGE_OPTIONS = [
  { value: NO_STAGE, label: 'No stage' },
  ...LIFECYCLE_STAGES.map((s) => ({ value: s, label: LIFECYCLE_LABELS[s] })),
]

interface TemplateEditorModalProps {
  isOpen: boolean
  onClose: () => void
  template: EmailTemplate | null
  businessName?: string
  contactName?: string
}

export function TemplateEditorModal({
  isOpen,
  onClose,
  template,
  businessName,
  contactName,
}: TemplateEditorModalProps) {
  const { toast } = useToast()
  const create = useCreateTemplate()
  const update = useUpdateTemplate()

  const [name, setName] = useState(template?.name ?? '')
  const [stage, setStage] = useState<string>(template?.lifecycle_stage ?? NO_STAGE)
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [content, setContent] = useState<JSONContent>(template?.content ?? EMPTY_BODY)

  const ctx = useMemo(() => buildSampleContext(businessName, contactName), [businessName, contactName])
  const saving = create.isPending || update.isPending

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
      lifecycle_stage: (stage === NO_STAGE ? null : stage) as EmailTemplate['lifecycle_stage'],
    }
    try {
      if (template) await update.mutateAsync({ id: template.id, input })
      else await create.mutateAsync(input)
      toast(template ? 'Template saved' : 'Template created', 'success')
      onClose()
    } catch {
      toast('Could not save template', 'error')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="fullscreen"
      title={template ? 'Edit template' : 'New template'}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            Save template
          </Button>
        </div>
      }
    >
      <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 overflow-y-auto">
          {/* Name + stage share a row — name takes the slack, stage sits
              compact beside it. Stacks on narrow viewports. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              className="sm:col-span-2"
              label="Template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quote follow-up"
            />
            <Select label="Lifecycle stage" value={stage} onValueChange={setStage} options={STAGE_OPTIONS} />
          </div>
          <SubjectField value={subject} onChange={setSubject} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-text">Body</p>
            <RichTextEditor
              value={content}
              onChange={setContent}
              variables={EMAIL_TEMPLATE_VARIABLES}
              placeholder="Write your email… use Insert variable to personalise it."
            />
          </div>
        </div>
        <div className="overflow-y-auto">
          <p className="mb-1.5 text-sm font-medium text-text">Preview</p>
          <p className="mb-3 text-xs text-text-subtle">Filled with example data so you can see the finished email.</p>
          <TemplatePreview subject={subject} content={content} ctx={ctx} />
        </div>
      </div>
    </Modal>
  )
}
