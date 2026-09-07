/**
 * Compose modal for the two manual step types (`todo`, `appointment`).
 *
 * Same treatment as the email, note and task steps: a name, a note and
 * a due-by rule are a small form, and a small form inside a 380px
 * canvas node is a cramped form. The node opens this instead of
 * expanding.
 *
 * It carries the timing control as well as the fields, because a
 * manual step that stops expanding on the card has nowhere else to put
 * it - and *when* a to-do comes due is the whole point of putting it
 * in a workflow.
 *
 * @module app/(dashboard)/workflows/[id]/manual-step-modal
 */
'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import type { StepTiming } from '@/types/workflows'

import { useMeetingTypeOptions } from './filter-options'
import { SelectField } from './inspector-extended'
import { TimingControl } from './timing-control'

/** Everything a manual step owns, edited as one draft and saved once. */
export interface ManualStepDraft {
  /** The step's title. Stored on the row, not in `config`. */
  label: string
  config: Record<string, unknown>
  timing: StepTiming
}

interface Props {
  isOpen: boolean
  onClose: () => void
  stepType: 'todo' | 'appointment'
  /** The step's saved values. Read once per open, not live-bound. */
  value: ManualStepDraft
  /** Hidden for the first step of a workflow, which has nothing above it. */
  allowAfterPrevious: boolean
  onSave: (draft: ManualStepDraft) => void
}

const COPY = {
  todo: {
    title: 'To-do',
    nameLabel: 'What needs doing',
    namePlaceholder: 'e.g. Ring the venue to confirm access time',
    notesPlaceholder: 'Anything you need to remember when you get to this',
    gating: 'This to-do is yours to tick off. Nothing anchored after it runs until you do.',
  },
  appointment: {
    title: 'Appointment',
    nameLabel: 'What is the appointment',
    namePlaceholder: 'e.g. Final planning call with the couple',
    notesPlaceholder: 'Where it is, who is coming, anything to bring',
    gating: 'This appointment is yours to tick off. Nothing anchored after it runs until you do.',
  },
} as const

/** The manual step composer. See {@link Props}. */
export function ManualStepModal({
  isOpen,
  onClose,
  stepType,
  value,
  allowAfterPrevious,
  onSave,
}: Props) {
  const copy = COPY[stepType]
  const meetingTypes = useMeetingTypeOptions()
  // One draft for the whole step, so the name, the note and the timing
  // save together rather than racing each other.
  const [draft, setDraft] = useState<ManualStepDraft>(value)

  // Hydrate on open, not on every value change: re-seeding mid-edit
  // would fight typing.
  useEffect(() => {
    if (!isOpen) return
    setDraft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const note = typeof draft.config['description'] === 'string' ? draft.config['description'] : ''
  const meetingTypeId =
    typeof draft.config['meetingTypeId'] === 'string' ? draft.config['meetingTypeId'] : ''

  function patchConfig(patch: Record<string, unknown>) {
    setDraft((prev) => ({ ...prev, config: { ...prev.config, ...patch } }))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.title}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            // The card reads "Give it a name" until there is one: an
            // unnamed manual step tells the MC nothing on the day.
            disabled={!draft.label.trim()}
            onClick={() => {
              onSave({ ...draft, label: draft.label.trim() })
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
          label={copy.nameLabel}
          placeholder={copy.namePlaceholder}
          value={draft.label}
          onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
        />

        {stepType === 'appointment' && (
          <div className="space-y-1">
            <SelectField
              label="Booked through"
              value={meetingTypeId}
              onChange={(v) => patchConfig({ meetingTypeId: v || undefined })}
              options={[
                { value: '', label: 'I will book it myself' },
                ...meetingTypes.map((m) => ({ value: m.value, label: m.label })),
              ]}
            />
            <p className="text-body text-text-muted">
              Pick a meeting type and this step ticks itself the moment the couple
              books that meeting. Leave it unset and it stays a reminder you tick by
              hand.
            </p>
          </div>
        )}

        <Textarea
          label="Notes"
          rows={5}
          // Fixed layout: dragging the field taller only pushes the
          // controls below it down inside a modal that is already sized.
          placeholder={copy.notesPlaceholder}
          value={note}
          onChange={(e) => patchConfig({ description: e.target.value })}
        />

        <TimingControl
          value={draft.timing}
          onChange={(timing) => setDraft((prev) => ({ ...prev, timing }))}
          allowAfterPrevious={allowAfterPrevious}
        />

        {/* A warning, not a caption: it is the one line on the form
            that changes what the workflow does. */}
        <Callout tone="warning">{copy.gating}</Callout>
      </div>
    </Modal>
  )
}
