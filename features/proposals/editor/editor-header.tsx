'use client'

/**
 * The layout editor's header (Proposal Layout v2 Phase 2 Task 14, UX
 * audit slice D §3.7): one `h-12` row above the canvas - a labelled back
 * link to Proposals, the document's name (click to rename, pencil
 * affordance), an optional `context` note about the document itself (the
 * proposal editor's "whose copy is this?" badge), the autosave status,
 * Preview, the device toggle, and an optional `trailing` action the
 * proposal editor uses for Send to couple. No
 * Save button (the editor autosaves) and no Undo/Redo buttons (2026-09-18
 * feedback: `⌘Z`/`⌘⇧Z` still work, wired independently in
 * `use-editor-shortcuts.ts`; only the header's own buttons were removed).
 * The status readout came back on 2026-09-20: with it gone, a failed save
 * was invisible and work was lost on refresh with nothing on screen to
 * say so. It is a muted label that reads "Saved" almost all of the time,
 * and only grows a button when something needs the MC ("Retry save" after
 * a failure, "Reload" after a conflict). The rename field and the status
 * label live in `editor-header-name-field.tsx`; the
 * Preview overlay itself and its Cmd/Ctrl+Shift+P shortcut are owned here
 * (rather than `layout-editor-body.tsx`) since this is the only place
 * that needs the Preview button's own ref, for returning focus to it on
 * close.
 *
 * @module features/proposals/editor/editor-header
 */
import { ArrowLeft, Eye, Monitor, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useRef, useState, type ReactNode } from 'react'

import { PillToggle, type CanvasDevice } from '@/components/editor'
import { Button, buttonClassName } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { SaveStatus } from '@/lib/branding/use-autosave'

import type { ProposalLayout } from '../model/layout'

import { NameField, SaveStatusLabel } from './editor-header-name-field'
import { PreviewOverlay } from './preview-overlay'
import { usePreviewShortcut } from './use-preview-shortcut'

/** Props for {@link EditorHeader}. */
export interface EditorHeaderProps {
  /** The document's current name: a template's name, or a proposal's title. */
  name: string
  /**
   * Commits a rename once the field is blurred/committed with an actually
   * different, non-empty name. Resolves `true` once applied, `false` if
   * rejected or it threw - same contract as `template-row.tsx`'s
   * `onRename`, whose optimistic-then-revert pattern `NameField` mirrors.
   */
  onRename: (name: string) => Promise<boolean>
  /**
   * A note about the document itself, rendered right after the name. The
   * proposal editor puts `ProposalCopyBadge` here, so the MC can see they
   * are in one couple's copy and not their template; the template editor
   * leaves it unset, so its header is unchanged.
   */
  context?: ReactNode
  /** Current autosave status, fed to `formatSaveStatus` for the header's status text. */
  status: SaveStatus
  /** When the layout last saved successfully, or `null` before the first save. */
  lastSavedAt: number | null
  /** Retries the last failed save. Shown as a "Retry save" button while `status === 'error'`. */
  onRetry: () => void
  /** The canvas's current preview device. Also seeds the Preview overlay's own (independent) device toggle each time it opens. */
  device: CanvasDevice
  onDeviceChange: (device: CanvasDevice) => void
  /** The editor's live, possibly-unsaved layout - what the Preview overlay renders. */
  layout: ProposalLayout
  branding: PublicBranding
  /**
   * An extra action rendered at the end of the row, after the device
   * toggle. The proposal editor puts Send to couple here; the template
   * editor has nothing to add and leaves it unset, so its header is
   * unchanged.
   */
  trailing?: ReactNode
}

/** One `h-12` row: back link, rename field, whatever `context` adds, save status, Preview, device toggle, and whatever `trailing` adds. */
export function EditorHeader({ name, onRename, context, status, lastSavedAt, onRetry, device, onDeviceChange, layout, branding, trailing }: EditorHeaderProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const previewButtonRef = useRef<HTMLButtonElement>(null)
  const closePreview = useCallback(() => {
    setPreviewOpen(false)
    // Returns focus to the control that opened it - Escape and the
    // overlay's own Close button both funnel through this one callback,
    // so neither path leaves focus stranded on a now-hidden element.
    previewButtonRef.current?.focus()
  }, [])
  const togglePreview = useCallback(() => setPreviewOpen((v) => !v), [])
  usePreviewShortcut(togglePreview)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      {/* Back goes to /proposals, not the Templates hub: since the
          single-page consolidation (2026-09-18) the templates an MC edits
          live as cards on /proposals, which is where they came from. */}
      <Link
        href="/proposals"
        className={buttonClassName({ variant: 'ghost', className: 'shrink-0 gap-1.5' })}
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Proposals
      </Link>

      {/* The context badge sits with the name, not out by the actions: it
          says what this document IS, so it has to read as part of the
          title rather than as another control. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <NameField value={name} onCommit={onRename} />
        {context}
      </div>

      <SaveStatusLabel status={status} lastSavedAt={lastSavedAt} onRetry={onRetry} />

      <Tooltip label="Preview" shortcut="⌘⇧P">
        <Button ref={previewButtonRef} variant="outline" onClick={togglePreview} className="gap-1.5">
          <Eye size={14} strokeWidth={1.5} />
          Preview
        </Button>
      </Tooltip>

      <PillToggle<CanvasDevice>
        value={device}
        onChange={onDeviceChange}
        options={[
          { value: 'desktop', label: 'Desktop', icon: <Monitor size={13} strokeWidth={1.5} /> },
          { value: 'mobile', label: 'Mobile', icon: <Smartphone size={13} strokeWidth={1.5} /> },
        ]}
      />

      {trailing}

      <PreviewOverlay
        isOpen={previewOpen}
        onClose={closePreview}
        layout={layout}
        branding={branding}
        initialDevice={device}
      />
    </header>
  )
}
