/**
 * Shared header for a Templates preview pane.
 *
 * Sits above every tab's read-only preview: the template name, an optional
 * meta chip (lifecycle stage for emails, total for line-item tabs), an
 * "Edited X ago" line, and the actions. The preview is read-only, so
 * `Edit` opens that tab's existing editor modal. On `sm+` Edit is a
 * visible button beside a `⋯` popover holding Duplicate / Delete; on
 * phones the button hides and Edit joins the popover instead.
 *
 * @module app/(dashboard)/templates/template-preview-header
 */
'use client'

import { Copy, Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { formatRelativeTime } from '@/lib/utils'

interface TemplatePreviewHeaderProps {
  title: string
  /** Optional muted line under the title (e.g. a package subtitle). */
  subtitle?: string
  /** Optional meta beside the title (e.g. a stage chip or total). */
  meta?: ReactNode
  /** ISO timestamp for the "Edited X ago" line. */
  updatedAt?: string | null
  /** Label for the primary edit button. */
  editLabel?: string
  onEdit: () => void
  onDuplicate?: () => void
  /** Extra menu entries, slotted between Duplicate and Delete
   *  (e.g. the Packages tab's Archive / Unarchive). */
  extraActions?: { label: string; icon?: ReactNode; onSelect: () => void }[]
  onDelete?: () => void
}

export function TemplatePreviewHeader({
  title,
  subtitle,
  meta,
  updatedAt,
  editLabel = 'Edit template',
  onEdit,
  onDuplicate,
  extraActions,
  onDelete,
}: TemplatePreviewHeaderProps) {
  // Capture "now" once at mount via a lazy initializer (Date.now() during
  // render is impure); the relative "Edited X ago" recomputes from props.
  const [nowMs] = useState(() => Date.now())
  const edited = updatedAt ? formatRelativeTime(updatedAt, nowMs) : ''

  const menuActions = [
    // Covered by the visible Edit button from `sm` up, so only phones
    // see it in the popover.
    { label: editLabel, icon: <Pencil size={15} strokeWidth={1.5} />, onSelect: onEdit, className: 'sm:hidden' },
    ...(onDuplicate
      ? [{ label: 'Duplicate', icon: <Copy size={15} strokeWidth={1.5} />, onSelect: onDuplicate }]
      : []),
    ...(extraActions ?? []),
    ...(onDelete
      ? [{ label: 'Delete', destructive: true, icon: <Trash2 size={15} strokeWidth={1.5} />, onSelect: onDelete }]
      : []),
  ]

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-section font-semibold text-text">{title || 'Untitled'}</h2>
          {meta}
        </div>
        {subtitle ? <p className="mt-1 truncate text-body text-text-muted">{subtitle}</p> : null}
        {edited ? <p className="mt-0.5 text-body text-text-muted">Edited {edited}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" className="hidden gap-1.5 sm:inline-flex" onClick={onEdit}>
          <Pencil size={14} strokeWidth={1.5} />
          Edit
        </Button>
        <RowActionsMenu alwaysVisible actions={menuActions} />
      </div>
    </div>
  )
}
