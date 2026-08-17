/**
 * Compose modal for the `create_timeline_event` step.
 *
 * Same shape as the task composer, because the step is the same
 * shape: a title, a description, and two optional parameters. Those
 * two are chips ("starts · 15:30", "runs for · 45 min") rather than
 * labelled inputs sitting empty on every card, which is the rule the
 * rest of the builder follows.
 *
 * @module app/(dashboard)/automations/[id]/timeline-composer-modal
 */
'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'

import { TIMELINE_ITEM_CHIPS } from './action-chips'
import { TriggerFilterList, type FilterConfig } from './trigger-filter-list'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The step's saved config. Read once per open, not live-bound. */
  config: Record<string, unknown>
  onSave: (draft: Record<string, unknown>) => void
}

export function TimelineComposerModal({ isOpen, onClose, config, onSave }: Props) {
  // One draft for the whole step, so the chips and the fields save
  // together rather than racing each other.
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  // Hydrate on open, not on every config change: re-seeding mid-edit
  // would fight typing.
  useEffect(() => {
    if (!isOpen) return
    setDraft({ ...config })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const title = typeof draft['title'] === 'string' ? draft['title'] : ''

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create timeline event"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            // The runner requires a title; saving without one leaves a
            // step that fails on its first run.
            disabled={!title.trim()}
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          placeholder="e.g. Ceremony"
          value={title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
        />

        <Textarea
          label="Description"
          rows={4}
          // Fixed layout: dragging the field taller only pushes the
          // options row down inside an already-sized modal.
          resizable={false}
          placeholder="Anything the couple or a vendor should know about this moment"
          value={typeof draft['description'] === 'string' ? draft['description'] : ''}
          onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
        />

        <div>
          <p className="mb-1.5 text-body font-medium text-text">Options</p>
          <TriggerFilterList
            filters={TIMELINE_ITEM_CHIPS}
            config={draft as FilterConfig}
            setConfig={(c) => setDraft(c as Record<string, unknown>)}
            addLabel="Add option"
          />
        </div>

        <p className="text-body text-text-muted">
          Added to the couple&apos;s event timeline when this step runs.
        </p>
      </div>
    </Modal>
  )
}
