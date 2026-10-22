'use client';


import type { ProposalDraft } from '../../account';
import { clearDraft, writeDraft } from '../../doc-builder/doc-types/proposal/drafts';
import { DocShell } from '../../doc-builder/shell/doc-shell';

import { EditorWorkspace } from './editor-workspace';
import { useProposalStart, type ProposalTarget } from './use-proposal-start';

export type { EditingSent } from './use-proposal-start';

/**
 * The proposal editor: the whole page to change, opened from Ready to
 * send's "Customise the page" (spec §3: live until accepted). It opens
 * close to full screen in the editor window every document shares and
 * keeps the work as a draft whatever way it is closed. Done returns to
 * Ready to send, which reads the same draft, so sending always happens
 * there, with the contract and invoices in view (2026-10-08 review: the
 * first proposal opened on this editor and lost new MCs). An `onSend`
 * keeps the old in-editor send for callers that have no Ready screen.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/proposal-editor
 */

export interface ProposalEditorProps {
  /** Who it is for, and the template key it starts from; closed while null. */
  target: ProposalTarget | null;
  /** Done or ×: the draft is kept. */
  onClose: () => void;
  onSend?: ((draft: ProposalDraft) => void) | undefined;
}

/** The editor. Keyed by the caller, so each opening reads the latest draft. See {@link ProposalEditorProps}. */
export function ProposalEditor({ target, onClose, onSend }: ProposalEditorProps) {
  return (
    <DocShell open={target !== null} onClose={onClose} aria-labelledby="editor-title">
      {target ? <EditorBody target={target} onClose={onClose} onSend={onSend} /> : null}
    </DocShell>
  );
}

/** The open editor, on the page {@link useProposalStart} opens. */
function EditorBody({ target, onClose, onSend }: ProposalEditorProps & { target: ProposalTarget }) {
  const start = useProposalStart(target);
  const { couple, wedding, editing } = target;
  return (
    <EditorWorkspace
      key={start.key}
      mode="proposal"
      title={editing ? `Changing ${couple}'s proposal` : `Proposal for ${couple}`}
      detail={editing ? 'They see the changes when you send it again' : `${wedding.date} · ${wedding.venue}`}
      who={start.who}
      initial={start.initial}
      initialTerms={start.initialTerms}
      restored={start.restored}
      fresh={start.fresh}
      fill={start.fill}
      keep={(page) => writeDraft(start.key, { ...page, at: Date.now() })}
      discard={() => clearDraft(start.key)}
      send={
        onSend
          ? {
              couple,
              greet: wedding.greet,
              onSend: (message, page) => {
                clearDraft(start.key);
                onSend({ template: start.template.id, headline: '', welcome: message, offer: page.offer, composed: page.composed });
              },
            }
          : undefined
      }
      onClose={onClose}
    />
  );
}
