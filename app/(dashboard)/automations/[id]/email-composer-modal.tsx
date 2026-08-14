/**
 * Compose modal for the `send_email` step.
 *
 * Writing an email needs room: recipients, a template choice, a
 * subject, a rich body, the files that go with it, and the delivery
 * options. That is a document, not a row of controls squeezed into a
 * 340px canvas node, so the step card opens this and shows only a
 * summary of what is configured.
 *
 * Deliberately the same three controls as the email-template editor
 * (`templates/template-editor-modal`), reusing its `SubjectField`,
 * `RichTextEditor` and `TemplateAttachments` rather than restating
 * them: an MC writing an automation email and one writing a template
 * should not meet two different editors.
 *
 * @module app/(dashboard)/automations/[id]/email-composer-modal
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select } from '@/components/ui/select'
import { EMAIL_TEMPLATE_VARIABLES } from '@/lib/email/template-variables'

import { EmailTemplatePicker } from '../../templates/email-template-picker'
import { SubjectField } from '../../templates/subject-field'
import { TemplateAttachments } from '../../templates/template-attachments'

import { EMAIL_OPTION_CHIPS } from './action-chips'
import { TriggerFilterList, type FilterConfig } from './trigger-filter-list'

/** Empty TipTap doc — an editor needs a paragraph to put a caret in. */
const EMPTY_BODY: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/** Recipient roles, in the order the checkboxes read. */
const ROLES = ['primary', 'spouse', 'family', 'vendor', 'me'] as const
type Role = (typeof ROLES)[number]

const ROLE_LABELS: Record<Role, string> = {
  primary: 'Primary couple email',
  spouse: 'Spouse',
  family: 'Family contacts',
  vendor: 'Vendor contacts',
  me: 'Myself (your email)',
}

interface RecipientSpec {
  roles: Role[]
  fallback: 'primary_only' | 'skip' | 'error'
}

const DEFAULT_RECIPIENTS: RecipientSpec = { roles: ['primary'], fallback: 'primary_only' }

/**
 * The whole step config. The composer owns every field — recipients,
 * template, content, attachments, options — so the card is a summary
 * and the modal is the one place an email is configured.
 */
export type EmailDraft = Record<string, unknown>

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The step's saved config. Read once per open, not live-bound. */
  config: Record<string, unknown>
  onSave: (draft: EmailDraft) => void
}

/**
 * Read the body out of a saved config.
 *
 * `content` is the composer's TipTap doc. `body` is the plain string
 * the action stored before this modal existed; it is lifted into a
 * paragraph so an older automation opens with its text intact rather
 * than blank, and saving migrates it to rich content.
 */
function initialContent(config: Record<string, unknown>): JSONContent {
  const content = config['content']
  if (content && typeof content === 'object') return content as JSONContent
  const body = typeof config['body'] === 'string' ? config['body'] : ''
  if (!body) return EMPTY_BODY
  return {
    type: 'doc',
    content: body.split('\n').map((line) => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  }
}

export function EmailComposerModal({ isOpen, onClose, config, onSave }: Props) {
  // One draft object for the whole step, so unrelated fields (the
  // option chips especially) survive a save untouched.
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [content, setContent] = useState<JSONContent>(EMPTY_BODY)

  // Hydrate on open, not on every config change: the card autosaves as
  // the draft changes, and re-seeding mid-edit would fight typing.
  useEffect(() => {
    if (!isOpen) return
    setDraft({ ...config })
    setContent(initialContent(config))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const patch = (fields: Record<string, unknown>) =>
    setDraft((prev) => ({ ...prev, ...fields }))

  const recipients = (draft['recipients'] as RecipientSpec | undefined) ?? DEFAULT_RECIPIENTS
  const templateId = typeof draft['templateId'] === 'string' ? draft['templateId'] : ''
  const attachFiles = Array.isArray(draft['attachFiles'])
    ? (draft['attachFiles'] as string[])
    : []

  function toggleRole(role: Role) {
    const has = recipients.roles.includes(role)
    const next = has ? recipients.roles.filter((r) => r !== role) : [...recipients.roles, role]
    // Never leave the list empty — an email with no recipient role is
    // a step that silently does nothing.
    patch({ recipients: { ...recipients, roles: next.length ? next : ['primary'] } })
  }

  function save() {
    onSave({
      ...draft,
      content,
      // The composer supersedes the legacy plain-text body; drop it so
      // the handler never prefers stale text over the doc just written.
      body: undefined,
      attachFiles: attachFiles.length ? attachFiles : undefined,
    })
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose email"
      size="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-body font-medium text-text">Send to</p>
          <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {ROLES.map((role) => (
              <Checkbox
                key={role}
                label={ROLE_LABELS[role]}
                checked={recipients.roles.includes(role)}
                onChange={() => toggleRole(role)}
              />
            ))}
          </div>
          <Select
            label="If none of those resolve"
            value={recipients.fallback}
            onValueChange={(v) =>
              patch({ recipients: { ...recipients, fallback: v as RecipientSpec['fallback'] } })
            }
            options={[
              { value: 'primary_only', label: 'Fall back to the primary couple email' },
              { value: 'skip', label: 'Skip this step silently' },
              { value: 'error', label: 'Fail the run' },
            ]}
          />
        </div>

        <EmailTemplatePicker
          value={templateId}
          onChange={(id) => patch({ templateId: id || undefined })}
        />

        {templateId ? (
          <p className="text-body text-text-muted">
            This email uses a saved template — edit its subject and body in Templates. If a
            variable can&apos;t be filled for a couple, the run pauses and you&apos;ll be alerted
            to fix &amp; retry.
          </p>
        ) : (
          <>
            <SubjectField
              value={typeof draft['subject'] === 'string' ? draft['subject'] : ''}
              onChange={(v) => patch({ subject: v })}
            />

            <div>
              <p className="mb-1 text-body font-medium text-text">Body</p>
              <RichTextEditor
                value={content}
                onChange={setContent}
                variables={EMAIL_TEMPLATE_VARIABLES}
                placeholder="Write the email the couple receives…"
              />
            </div>

            {/* templateId is null: these files belong to the automation
                step, not a template, so the ids live in the action
                config and hydrate the list through `fileIds`. */}
            <TemplateAttachments
              templateId={null}
              fileIds={attachFiles}
              emptyHint="Files attached here are sent every time this step runs."
              onPendingChange={(ids) =>
                patch({ attachFiles: [...new Set([...attachFiles, ...ids])] })
              }
            />
          </>
        )}

        <div>
          <p className="mb-1.5 text-body font-medium text-text">Options</p>
          <TriggerFilterList
            filters={EMAIL_OPTION_CHIPS}
            config={draft as FilterConfig}
            setConfig={(c) => setDraft(c as Record<string, unknown>)}
            addLabel="Add option"
          />
        </div>
      </div>
    </Modal>
  )
}
