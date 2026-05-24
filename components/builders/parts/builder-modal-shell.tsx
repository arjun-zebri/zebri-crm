/**
 * Outer shell for the Quote / Invoice builder modals.
 *
 * Wraps the canonical `<Modal>` primitive and adds the bits both
 * builders share:
 * - Header layout: document number (Q-001 / INV-001) + state pill +
 *   optional contextual primary CTA + ⋯ overflow menu + close.
 * - Hero title input inside the modal body (large unbordered text
 *   input, Notion-style).
 * - Footer slot for the share-link + save + send row.
 *
 * Status-changing actions (Mark paid, Revert, Cancel, Delete) live
 * in `overflowItems`; the most common next-action lives in
 * `primaryAction` and renders as a small primary button right in the
 * header — keeps it visible without crowding the row.
 *
 * @module components/builders/parts/builder-modal-shell
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { StatePill, type StatePillProps } from '@/components/ui/state-pill';

export interface OverflowMenuItem {
  label: string;
  onClick: () => void;
  /** Renders the item in danger tone — used for destructive actions. */
  danger?: boolean;
  /** Disable the item without removing it (keeps the user oriented). */
  disabled?: boolean;
}

export interface BuilderModalPrimaryAction {
  label: string;
  onClick: () => void;
  /** Loading state propagates to a spinner + disables the button. */
  loading?: boolean | undefined;
  /** Render the button in danger tone (for "Mark paid" on an overdue invoice). */
  variant?: 'primary' | 'danger' | undefined;
}

export interface BuilderModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** e.g. "Q-001" or "INV-001". Loading: pass `null`. */
  documentNumber: ReactNode;
  /** Renders inline with the document number. Omit for "new" docs. */
  statePill?: StatePillProps | undefined;
  /** Status-aware single primary CTA. Omit when not applicable. */
  primaryAction?: BuilderModalPrimaryAction | undefined;
  /** Items in the ⋯ overflow menu. Omit when the menu is empty (or
   *  when only `primaryAction` is offered). */
  overflowItems?: OverflowMenuItem[] | undefined;
  /** Click handler for the dedicated trash-icon button in the
   *  header. Surfaced separately from the overflow menu so deleting
   *  is one click + visible — not buried behind a ⋯. */
  onDelete?: (() => void) | undefined;
  /** Label for the delete button's aria-label / tooltip. */
  deleteLabel?: string | undefined;
  /** The big editable title that lives at the top of the modal body. */
  title: string;
  /** Updates while the user types the title. */
  onTitleChange: (next: string) => void;
  /** Placeholder when the title is empty. */
  titlePlaceholder?: string | undefined;
  /** Locks title editing (e.g. paid invoice). */
  titleReadOnly?: boolean | undefined;
  /** Modal body content (meta row + items + totals + …). */
  children: ReactNode;
  /** Sticky footer row (share + save + send). */
  footer: ReactNode;
  /** Optional right-pane preview (Phase 2C.2). When provided, the
   *  modal switches to a two-column grid on `lg:` and `fullscreen`
   *  modal size — the form takes the left column, the preview takes
   *  the right. Below `lg:` the preview becomes a collapsible
   *  section below the form. */
  previewPane?: ReactNode | undefined;
  /** When true: render skeleton placeholders in place of the form
   *  body + the preview pane while the parent is fetching. Modal
   *  shell, title bar, and footer stay rendered so the modal's
   *  size doesn't change while loading. */
  loading?: boolean | undefined;
}

export function BuilderModalShell({
  isOpen,
  onClose,
  documentNumber,
  statePill,
  primaryAction,
  overflowItems,
  title,
  onTitleChange,
  titlePlaceholder,
  titleReadOnly = false,
  children,
  footer,
  previewPane,
  onDelete,
  deleteLabel = 'Delete',
  loading = false,
}: BuilderModalShellProps) {
  const twoPane = Boolean(previewPane);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={twoPane ? 'fullscreen' : 'xl'}
      title={
        <>
          <span className="text-text">{documentNumber}</span>
          {statePill ? <StatePill {...statePill} /> : null}
        </>
      }
      headerActions={
        <div className="flex items-center gap-2">
          {primaryAction ? (
            <Button
              size="sm"
              variant={primaryAction.variant === 'danger' ? 'danger' : 'primary'}
              onClick={primaryAction.onClick}
              {...(primaryAction.loading ? { loading: true } : {})}
            >
              {primaryAction.label}
            </Button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label={deleteLabel}
              title={deleteLabel}
              className="p-1.5 text-text-muted hover:text-danger transition cursor-pointer rounded-control"
            >
              <Trash2 size={18} strokeWidth={1.5} />
            </button>
          ) : null}
          {overflowItems && overflowItems.length > 0 ? (
            <OverflowMenu items={overflowItems} />
          ) : null}
        </div>
      }
      footer={footer}
    >
      {twoPane ? (
        // Two-pane layout: editor on the left (lg:col-1), preview
        // on the right (lg:col-2). Below the lg breakpoint they
        // stack vertically — preview comes after the form.
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 h-full">
          {/* Left pane scrolls internally so the modal's footer +
              the right-pane preview stay anchored regardless of
              form height. */}
          <div className="flex flex-col min-w-0 min-h-0 overflow-y-auto pr-1">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={titlePlaceholder}
              readOnly={titleReadOnly || loading}
              disabled={titleReadOnly || loading}
              className="w-full bg-transparent text-section font-semibold text-text placeholder:text-text-subtle focus:outline-none disabled:opacity-70"
            />
            <div className="mt-6 flex-1">{loading ? <EditorSkeleton /> : children}</div>
          </div>
          <div className="min-w-0 min-h-[60vh] lg:min-h-0">
            {loading ? <PreviewSkeleton /> : previewPane}
          </div>
        </div>
      ) : (
        // Single-column layout (legacy callers).
        <>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={titlePlaceholder}
            readOnly={titleReadOnly || loading}
            disabled={titleReadOnly || loading}
            className="w-full bg-transparent text-section font-semibold text-text placeholder:text-text-subtle focus:outline-none disabled:opacity-70"
          />
          <div className="mt-6">{loading ? <EditorSkeleton /> : children}</div>
        </>
      )}
    </Modal>
  );
}

/* ─── Loading skeletons ────────────────────────────────────────── */

function EditorSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Meta row */}
      <div className="flex gap-2">
        <div className="h-8 w-40 rounded-control bg-surface-muted" />
        <div className="h-8 w-32 rounded-control bg-surface-muted" />
      </div>
      {/* Items header */}
      <div className="space-y-2">
        <div className="h-9 w-full rounded-card bg-surface-muted" />
        <div className="h-12 w-full rounded-card bg-surface-muted/60" />
        <div className="h-12 w-full rounded-card bg-surface-muted/60" />
        <div className="h-12 w-full rounded-card bg-surface-muted/60" />
      </div>
      {/* Discount + tax + totals */}
      <div className="flex justify-between gap-4">
        <div className="flex gap-2">
          <div className="h-7 w-24 rounded-pill bg-surface-muted" />
          <div className="h-7 w-28 rounded-pill bg-surface-muted" />
        </div>
        <div className="w-48 space-y-2">
          <div className="h-3 w-full rounded bg-surface-muted" />
          <div className="h-3 w-full rounded bg-surface-muted" />
          <div className="h-4 w-full rounded bg-surface-muted" />
        </div>
      </div>
      {/* Notes */}
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-surface-muted" />
        <div className="h-24 w-full rounded-card bg-surface-muted/60" />
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-card bg-surface-muted/60 p-4 sm:p-5 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 rounded bg-surface-muted" />
        <div className="h-7 w-60 rounded-card bg-surface" />
      </div>
      <div className="h-3 w-40 rounded bg-surface-muted" />
      {/* Document body placeholder */}
      <div className="flex-1 rounded-card border border-border bg-surface p-6 space-y-4">
        <div className="h-5 w-32 rounded bg-surface-muted" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-surface-muted/60" />
          <div className="h-3 w-3/4 rounded bg-surface-muted/60" />
        </div>
        <div className="h-px w-full bg-border" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-surface-muted/60" />
          <div className="h-3 w-full rounded bg-surface-muted/60" />
          <div className="h-3 w-2/3 rounded bg-surface-muted/60" />
        </div>
      </div>
    </div>
  );
}

/* ─── Overflow menu ────────────────────────────────────────────── */

function OverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="p-1.5 text-text-muted hover:text-text transition cursor-pointer rounded-control"
          aria-label="More actions"
        >
          <MoreHorizontal size={18} strokeWidth={1.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[90] min-w-[12rem] rounded-card border border-border bg-surface shadow-lg p-1 animate-fade-in"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full cursor-pointer items-center rounded-control px-2.5 py-1.5 text-body text-left transition-colors hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed ${
                item.danger ? 'text-danger' : 'text-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
