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
import { MoreHorizontal } from 'lucide-react';
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
  loading?: boolean;
  /** Render the button in danger tone (for "Mark paid" on an overdue invoice). */
  variant?: 'primary' | 'danger';
}

export interface BuilderModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** e.g. "Q-001" or "INV-001". Loading: pass `null`. */
  documentNumber: ReactNode;
  /** Renders inline with the document number. Omit for "new" docs. */
  statePill?: StatePillProps;
  /** Status-aware single primary CTA. Omit when not applicable. */
  primaryAction?: BuilderModalPrimaryAction;
  /** Items in the ⋯ overflow menu. Omit when the menu is empty (or
   *  when only `primaryAction` is offered). */
  overflowItems?: OverflowMenuItem[];
  /** The big editable title that lives at the top of the modal body. */
  title: string;
  /** Updates while the user types the title. */
  onTitleChange: (next: string) => void;
  /** Placeholder when the title is empty. */
  titlePlaceholder?: string;
  /** Locks title editing (e.g. paid invoice). */
  titleReadOnly?: boolean;
  /** Modal body content (meta row + items + totals + …). */
  children: ReactNode;
  /** Sticky footer row (share + save + send). */
  footer: ReactNode;
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
}: BuilderModalShellProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
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
              loading={primaryAction.loading}
            >
              {primaryAction.label}
            </Button>
          ) : null}
          {overflowItems && overflowItems.length > 0 ? (
            <OverflowMenu items={overflowItems} />
          ) : null}
        </div>
      }
      footer={footer}
    >
      {/* Hero title input — large unbordered text field at the top
          of the modal body. Click/tab away commits the value (it's
          saved with the rest of the form). */}
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={titlePlaceholder}
        readOnly={titleReadOnly}
        disabled={titleReadOnly}
        className="w-full bg-transparent text-section font-semibold text-text placeholder:text-text-subtle focus:outline-none disabled:opacity-70"
      />
      <div className="mt-6">{children}</div>
    </Modal>
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
