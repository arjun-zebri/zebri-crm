/**
 * Compose modal for the `send_couple_questionnaire` step.
 *
 * This step's email is **canned**: the handler builds it from
 * `questionnaireHtml`, and the only things the MC controls are which
 * questionnaire goes out and what it is called. That is exactly why
 * it needs a preview rather than a form — the two settings are small,
 * and the question worth answering is "what does the couple actually
 * receive?".
 *
 * The preview is the real builder, the same pure function the sender
 * calls, so it cannot drift from what is sent. `EmailPreview` holds
 * it back until the MC's branding has loaded, so the first frame they
 * see is the branded one. Sample couple details
 * (the automation is not attached to a couple) but the MC's real
 * business name and branding, or they would be previewing someone
 * else's email.
 *
 * @module app/(dashboard)/automations/[id]/questionnaire-composer-modal
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { questionnaireHtml } from '@/lib/email/html'

import { loadSenderIdentityAction } from '../actions'

import { EmailPreview } from './email-preview'
import { useQuestionnaireTemplateOptions } from './filter-options'

/** Stand-ins for the couple the run will actually be about. */
const SAMPLE_COUPLE = 'Sam & Alex'
const SAMPLE_LINK = 'https://app.zebri.com.au/questionnaire/…'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The step's saved config. Read once per open, not live-bound. */
  config: Record<string, unknown>
  onSave: (draft: Record<string, unknown>) => void
}

export function QuestionnaireComposerModal({ isOpen, onClose, config, onSave }: Props) {
  const templates = useQuestionnaireTemplateOptions()
  const [templateId, setTemplateId] = useState('')
  const [title, setTitle] = useState('')

  // Hydrate on open, not on every config change: re-seeding mid-edit
  // would fight typing.
  useEffect(() => {
    if (!isOpen) return
    setTemplateId(typeof config['questionnaireTemplateId'] === 'string' ? config['questionnaireTemplateId'] : '')
    setTitle(typeof config['title'] === 'string' ? config['title'] : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const { data: identity } = useQuery({
    queryKey: ['automation-sender-identity'],
    enabled: isOpen,
    queryFn: () => loadSenderIdentityAction(),
  })

  const businessName = identity?.businessName ?? 'Your business'
  const templateName = templates.find((t) => t.value === templateId)?.label ?? ''
  // The handler's own fallback: an empty override sends the template's
  // name, so the preview has to show that and not a blank heading.
  const effectiveTitle = title.trim() || templateName

  const previewHtml = useMemo(
    () =>
      questionnaireHtml(
        {
          coupleName: SAMPLE_COUPLE,
          title: effectiveTitle || 'Your questionnaire',
          shareUrl: SAMPLE_LINK,
          mcBusinessName: businessName,
        },
        identity?.branding ?? null,
      ),
    [effectiveTitle, businessName, identity],
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send questionnaire"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            // The runner requires a template id, so saving without one
            // leaves a step that fails on its first run.
            disabled={!templateId}
            onClick={() => {
              onSave({
                ...config,
                questionnaireTemplateId: templateId,
                title: title.trim() || undefined,
              })
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Questionnaire"
            value={templateId}
            onValueChange={setTemplateId}
            placeholder={templates.length ? 'Choose a questionnaire…' : 'No questionnaires yet'}
            options={templates.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Input
            label="Title (optional)"
            placeholder={templateName || "The questionnaire's own name"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            help="What the couple sees as the heading."
          />
        </div>

        <EmailPreview
          ready={identity !== undefined}
          subject={`${businessName} sent you a few questions`}
          html={previewHtml}
          frameTitle="Questionnaire email preview"
          caption="Shown with a sample couple and link."
          height="h-96"
        />
      </div>
    </Modal>
  )
}
