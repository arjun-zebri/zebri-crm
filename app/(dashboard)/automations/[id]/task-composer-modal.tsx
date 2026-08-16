/**
 * Compose modal for the `create_task` step.
 *
 * Same reasoning as the email composer: a title, a description and a
 * due date are a small form, and a small form in a 380px canvas node
 * is a cramped form. The node opens this instead of expanding.
 *
 * @module app/(dashboard)/automations/[id]/task-composer-modal
 */
'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'

import { taskDueChip } from './action-chips'
import { TriggerFilterList, type FilterConfig } from './trigger-filter-list'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The step's saved config. Read once per open, not live-bound. */
  config: Record<string, unknown>
  onSave: (draft: Record<string, unknown>) => void
}

export function TaskComposerModal({ isOpen, onClose, config, onSave }: Props) {
  // One draft for the whole step, so the due chip and the fields save
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
      title="Create task"
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
          label="Task title"
          placeholder="e.g. Confirm ceremony song with couple"
          value={title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
        />

        <Textarea
          label="Description"
          rows={5}
          // Fixed layout: dragging the field taller only pushes the
          // options row down inside a modal that is already sized.
          resizable={false}
          placeholder="Anything you'll want to remember when this lands on your list"
          value={typeof draft['description'] === 'string' ? draft['description'] : ''}
          onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
        />

        <div>
          <p className="mb-1.5 text-body font-medium text-text">Options</p>
          <TriggerFilterList
            filters={[taskDueChip(true)]}
            config={draft as FilterConfig}
            setConfig={(c) => setDraft(c as Record<string, unknown>)}
            addLabel="Add option"
          />
        </div>
      </div>
    </Modal>
  )
}
