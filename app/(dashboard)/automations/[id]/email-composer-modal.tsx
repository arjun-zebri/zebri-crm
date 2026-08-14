/**
 * Compose modal for the `send_email` step.
 *
 * Writing an email needs room: a subject, a rich body, and the files
 * that go with it. That is a document, not a row of chips, so the step
 * card opens this instead of expanding in place. What stays on the
 * card is everything chip-shaped — who it goes to, the branded shell,
 * CC/BCC, reply-to.
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
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { EMAIL_TEMPLATE_VARIABLES } from '@/lib/email/template-variables'

import { SubjectField } from '../../templates/subject-field'
import { TemplateAttachments } from '../../templates/template-attachments'

/** Empty TipTap doc — an editor needs a paragraph to put a caret in. */
const EMPTY_BODY: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export interface EmailDraft {
  subject: string
  content: JSONContent
  attachFiles: string[]
}

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
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState<JSONContent>(EMPTY_BODY)
  const [attachFiles, setAttachFiles] = useState<string[]>([])

  // Hydrate on open, not on every config change: the parent autosaves
  // as the card is edited, and re-seeding mid-edit would fight typing.
  useEffect(() => {
    if (!isOpen) return
    setSubject(typeof config['subject'] === 'string' ? config['subject'] : '')
    setContent(initialContent(config))
    setAttachFiles(
      Array.isArray(config['attachFiles']) ? (config['attachFiles'] as string[]) : [],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function save() {
    onSave({ subject, content, attachFiles })
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
      <div className="space-y-4">
        <SubjectField value={subject} onChange={setSubject} />

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
            step, not a template, so the ids live in the action config
            and hydrate the list through `fileIds`. */}
        <TemplateAttachments
          templateId={null}
          fileIds={attachFiles}
          emptyHint="Files attached here are sent every time this step runs."
          onPendingChange={(ids) =>
            setAttachFiles((prev) => [...new Set([...prev, ...ids])])
          }
        />
      </div>
    </Modal>
  )
}
