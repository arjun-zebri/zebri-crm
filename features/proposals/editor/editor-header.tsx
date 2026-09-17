'use client'

/**
 * The template editor's header (Proposal Layout v2 Phase 2 Task 14): one
 * `h-12` row above the canvas - a back link to Templates, the template
 * name (click to rename), the autosave status, Undo/Redo, and the device
 * toggle. No Save button (the editor autosaves) and no Preview yet (the
 * public page ships in Phase 4). The rename field and the save-status
 * label live in `editor-header-name-field.tsx`, split out to keep this
 * file under the ~150-line guideline.
 *
 * @module features/proposals/editor/editor-header
 */
import { ArrowLeft, Monitor, Redo2, Smartphone, Undo2 } from 'lucide-react'
import Link from 'next/link'

import { PillToggle, type CanvasDevice } from '@/components/editor'
import { Button, buttonClassName } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import type { SaveStatus } from '@/lib/branding/use-autosave'

import { NameField, SaveStatusLabel } from './editor-header-name-field'

/** Props for {@link EditorHeader}. */
export interface EditorHeaderProps {
  /** The template's current name. */
  name: string
  /**
   * Commits a rename once the field is blurred/committed with an actually
   * different, non-empty name. Resolves `true` once applied, `false` if
   * rejected or it threw - same contract as `template-row.tsx`'s
   * `onRename`, whose optimistic-then-revert pattern `NameField` mirrors.
   */
  onRename: (name: string) => Promise<boolean>
  /** Current autosave status, fed to `formatSaveStatus` for the header's status text. */
  status: SaveStatus
  /** When the layout last saved successfully, or `null` before the first save. */
  lastSavedAt: number | null
  /** Retries the last failed save. Shown as a "Retry save" button while `status === 'error'`. */
  onRetry: () => void
  /** Whether Undo is available. */
  canUndo: boolean
  /** Whether Redo is available. */
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** The canvas's current preview device. */
  device: CanvasDevice
  onDeviceChange: (device: CanvasDevice) => void
}

/** One `h-12` row: back link, rename field, save status, undo/redo, device toggle. */
export function EditorHeader({
  name, onRename, status, lastSavedAt, onRetry, canUndo, canRedo, onUndo, onRedo, device, onDeviceChange,
}: EditorHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <Tooltip label="Back to Templates">
        <Link
          href="/proposals/templates"
          aria-label="Back to Templates"
          className={buttonClassName({ variant: 'ghost', iconOnly: true })}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
      </Tooltip>

      <div className="min-w-0 flex-1">
        <NameField value={name} onCommit={onRename} />
      </div>

      <SaveStatusLabel status={status} lastSavedAt={lastSavedAt} onRetry={onRetry} />

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip label="Undo" shortcut="⌘Z">
          <Button variant="ghost" iconOnly aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
            <Undo2 size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <Tooltip label="Redo" shortcut="⌘⇧Z">
          <Button variant="ghost" iconOnly aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
            <Redo2 size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
      </div>

      <PillToggle<CanvasDevice>
        value={device}
        onChange={onDeviceChange}
        options={[
          { value: 'desktop', label: 'Desktop', icon: <Monitor size={13} strokeWidth={1.5} /> },
          { value: 'mobile', label: 'Mobile', icon: <Smartphone size={13} strokeWidth={1.5} /> },
        ]}
      />
    </header>
  )
}
