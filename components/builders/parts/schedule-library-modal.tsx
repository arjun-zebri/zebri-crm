/**
 * The schedule library: a modal that manages the reusable set of saved
 * schedules. List mode applies a schedule in one tap or opens management via an
 * overflow menu; editor mode edits or creates one. Saving in the editor writes
 * to the library only and never touches the current invoice.
 *
 * @module components/builders/parts/schedule-library-modal
 */
'use client'

import { useState } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import type { PaymentSchedule, TemplateStage } from '@/types/payment-schedule'

import { ScheduleEditor } from './schedule-editor'
import { ScheduleLibraryList } from './schedule-library-list'

/** Which view the modal is showing. */
type Mode = { kind: 'list' } | { kind: 'editor'; schedule: PaymentSchedule | null }

/** Props for {@link ScheduleLibraryModal}. */
export interface ScheduleLibraryModalProps {
  open: boolean
  onClose: () => void
  schedules: PaymentSchedule[]
  loading: boolean
  error: string | null
  hasPaidStage: boolean
  onApply: (schedule: PaymentSchedule) => void
  onCreate: (input: { name: string; stages: TemplateStage[] }) => Promise<void>
  onUpdate: (input: { id: string; name?: string; stages?: TemplateStage[] }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetDefault: (id: string) => Promise<void>
}

/** The saved-schedule library modal. See {@link ScheduleLibraryModalProps}. */
export function ScheduleLibraryModal({
  open,
  onClose,
  schedules,
  loading,
  error,
  hasPaidStage,
  onApply,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
}: ScheduleLibraryModalProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PaymentSchedule | null>(null)

  const toList = () => {
    setMode({ kind: 'list' })
    setDirty(false)
    setLeaveConfirm(false)
  }

  // The editor is the only mode that can hold unsaved work, so the guard only
  // fires there.
  const leaveEditor = () => {
    if (mode.kind === 'editor' && dirty) setLeaveConfirm(true)
    else toList()
  }

  const close = () => {
    if (mode.kind === 'editor' && dirty) {
      setLeaveConfirm(true)
      return
    }
    toList()
    onClose()
  }

  const save = async (input: { name: string; stages: TemplateStage[] }) => {
    if (mode.kind !== 'editor') return
    setSaving(true)
    try {
      if (mode.schedule) await onUpdate({ id: mode.schedule.id, ...input })
      else await onCreate(input)
      toList()
    } catch {
      // Leave the editor open with values intact so nothing is retyped.
      toast('Could not save the schedule. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async (s: PaymentSchedule) => {
    try {
      await onCreate({ name: `${s.name} copy`, stages: s.stages })
    } catch {
      toast('Could not duplicate the schedule. Try again.', 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await onDelete(deleteTarget.id)
    } catch {
      toast('Could not delete the schedule. Try again.', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <Modal isOpen={open} onClose={close} title="Payment schedule" size="md" nested>
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : mode.kind === 'editor' ? (
          <ScheduleEditor
            schedule={mode.schedule}
            saving={saving}
            onBack={leaveEditor}
            onDirtyChange={setDirty}
            onSave={save}
          />
        ) : (
          <div className="space-y-4">
            <ScheduleLibraryList
              schedules={schedules}
              onApply={onApply}
              onEdit={(s) => setMode({ kind: 'editor', schedule: s })}
              onDuplicate={duplicate}
              onSetDefault={onSetDefault}
              onDelete={setDeleteTarget}
              onNew={() => {
                setDirty(false)
                setMode({ kind: 'editor', schedule: null })
              }}
            />
            {hasPaidStage && (
              <p className="text-caption text-text-subtle">
                Applying a different schedule keeps any stage that is already paid.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={leaveConfirm}
        title="Discard changes?"
        description="This schedule has unsaved changes. Leaving will discard them."
        confirmLabel="Discard"
        loadingLabel="Discarding..."
        onCancel={() => setLeaveConfirm(false)}
        onConfirm={toList}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete schedule?"
        description="Invoices already using this schedule keep their stages. This only removes it from your library."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
