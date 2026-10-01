'use client';

import { useRef } from 'react';

import { Dialog } from '@/components/ui-v2/dialog';

import { PreviewFor } from '../proposal-preview';
import type { Proposal } from '../proposals-data';
import type { ProposalsState } from '../use-proposals-state';

import { NudgeDialog } from './nudge-dialog';
import { ProposalHeader } from './proposal-header';
import { ProposalSide } from './proposal-side';
import { useReadingPosition } from './use-reading-position';

/**
 * A proposal opened from the Proposals page: an `xl` v2 dialog (full
 * screen on phones), laid out like the Payments invoice modal. The
 * header names the couple and holds the actions. Below, to the user's
 * mockup: the proposal as the couple sees it on a soft grey desk on the
 * left (nothing above it); on the right, where it stands, the facts,
 * where their attention went, and its activity. Scrolling the preview
 * bolds the section being read in the attention chart and moves a line
 * down its shape (`use-reading-position.ts`). Nudge opens Zebri's
 * drafted follow-up as a second dialog in front.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/modal/proposal-modal
 */

export interface ProposalModalProps {
  /** The open proposal's id; closed while null. */
  id: string | null;
  /** Whether the nudge dialog is open. */
  composing: boolean;
  onCompose: (open: boolean) => void;
  state: ProposalsState;
  /** Edit: opens the builder stub for this proposal. */
  onEdit: (p: Proposal) => void;
  onClose: () => void;
}

/** The proposal dialog. See {@link ProposalModalProps}. */
export function ProposalModal({ id, composing, onCompose, state, onEdit, onClose }: ProposalModalProps) {
  const p = id ? state.proposals.find((x) => x.id === id) : undefined;
  const preview = useRef<HTMLDivElement>(null);
  const reading = useReadingPosition(preview, p?.id ?? null);
  return (
    <>
      <Dialog open={p !== undefined} onClose={onClose} size="xl" aria-labelledby="proposal-title">
        {p ? (
          <>
            <ProposalHeader proposal={p} state={state} onNudge={() => onCompose(true)} onEdit={() => onEdit(p)} onClose={onClose} />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:overflow-hidden">
              <div ref={preview} className="bg-zebra-50 p-5 md:p-8 lg:overflow-y-auto">
                <PreviewFor proposal={p} className="mx-auto max-w-xl" />
              </div>
              <div className="border-zebra-950/5 p-5 md:p-6 lg:overflow-y-auto lg:border-l">
                <ProposalSide proposal={p} reading={reading} />
              </div>
            </div>
          </>
        ) : null}
      </Dialog>
      {/* After the proposal's dialog, so it opens in front of it. */}
      {p ? (
        <NudgeDialog
          key={`${p.id}-${composing}`}
          proposal={p}
          open={composing}
          onClose={() => onCompose(false)}
          onSent={() => {
            state.nudge(p.id);
            onCompose(false);
          }}
        />
      ) : null}
    </>
  );
}
