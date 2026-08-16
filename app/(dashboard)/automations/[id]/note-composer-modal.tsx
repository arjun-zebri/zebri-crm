/**
 * Compose modal for the `add_note` step.
 *
 * A note is prose, and prose written five rows at a time inside a
 * 380px canvas node is prose written through a letterbox. Same
 * treatment as the email and task steps: the node opens this.
 *
 * It uses the same editor the email composer does, so variables
 * behave the way they do everywhere else in the app: type `@` for the
 * inline list, or use the toolbar's "Insert variable", and what lands
 * is a green chip rather than raw braces. The note itself is stored
 * as a plain mustache string, because the handler appends it to
 * `couples.notes` — a text column — so the doc is flattened on save
 * and lifted again on open (`lib/automations/mustache-doc`).
 *
 * @module app/(dashboard)/automations/[id]/note-composer-modal
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { docToText, textToDoc, type DocNode } from '@/lib/automations/mustache-doc'
import { EMAIL_TEMPLATE_VARIABLES } from '@/lib/email/template-variables'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The step's saved config. Read once per open, not live-bound. */
  config: Record<string, unknown>
  onSave: (draft: Record<string, unknown>) => void
}

export function NoteComposerModal({ isOpen, onClose, config, onSave }: Props) {
  const [doc, setDoc] = useState<JSONContent>(() => textToDoc('') as JSONContent)

  // Hydrate on open, not on every config change: re-seeding mid-edit
  // would fight typing.
  useEffect(() => {
    if (!isOpen) return
    const text = typeof config['text'] === 'string' ? config['text'] : ''
    setDoc(textToDoc(text) as JSONContent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const text = docToText(doc as DocNode)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add note"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            // The runner requires the text; saving without it leaves a
            // step that fails on its first run.
            disabled={!text.trim()}
            onClick={() => {
              onSave({ ...config, text })
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {/* No label: the modal's title already says what this is, and
            a lone field under a heading does not need naming twice. */}
        <RichTextEditor
          value={doc}
          onChange={setDoc}
          variables={EMAIL_TEMPLATE_VARIABLES}
          placeholder="What should be written on the couple's record when this runs? Type @ for a variable."
        />
        <p className="text-body text-text-muted">
          Appended to the couple&apos;s notes with today&apos;s date.
        </p>
      </div>
    </Modal>
  )
}
