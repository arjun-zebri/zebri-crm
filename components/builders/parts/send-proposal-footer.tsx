'use client';

/**
 * The footer of the Send a proposal modal: the two things an MC can do
 * with the page they are looking at, and, when Send is off, the one line
 * that says why.
 *
 * The reason is a real element wired to the button with
 * `aria-describedby`, not a tooltip: a disabled control cannot take focus
 * or hover, so a tooltip is exactly the thing a person who needs the
 * explanation will never see.
 *
 * @module components/builders/parts/send-proposal-footer
 */
import { useId } from 'react';

import { Button } from '@/components/ui/button';

/** Props for {@link SendProposalFooter}. */
export interface SendProposalFooterProps {
  /** Why Send is disabled, or null when it is ready. */
  blockedReason: string | null;
  /**
   * True while the modal is still loading what Send depends on. Both
   * actions are off, and no reason is shown: "Choose a couple first"
   * under a couple that simply has not arrived yet reads as an error the
   * MC has to fix.
   */
  loading: boolean;
  /** Whether "Make edits" can run: it needs a couple and a template, but not an email address. */
  canEdit: boolean;
  sending: boolean;
  /** True while "Make edits" is creating the proposal, before the editor opens. */
  editing: boolean;
  onEdit: () => void;
  onSend: () => void;
}

/** See {@link SendProposalFooterProps}. */
export function SendProposalFooter({ blockedReason, loading, canEdit, sending, editing, onEdit, onSend }: SendProposalFooterProps) {
  const reasonId = useId();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {blockedReason ? (
        <p id={reasonId} className="text-body text-text-muted">
          {blockedReason}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2 sm:ml-auto">
        <Button variant="secondary" onClick={onEdit} loading={editing} disabled={loading || !canEdit || sending}>
          Make edits
        </Button>
        <Button
          onClick={onSend}
          loading={sending}
          disabled={loading || blockedReason !== null || editing}
          {...(blockedReason ? { 'aria-describedby': reasonId } : {})}
        >
          Send to couple
        </Button>
      </div>
    </div>
  );
}
