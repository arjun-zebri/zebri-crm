'use client';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { ProposalIcon } from '@/components/ui-v2/icons';

import { MoreMenu, type MoreItem } from '../../payments/modal/more-menu';
import { coupleName, money } from '../../payments/payments-data';
import { weddingLine, type Proposal } from '../proposals-data';
import { templateOf } from '../templates-data';
import type { ProposalsState } from '../use-proposals-state';

/**
 * The proposal modal's header, on the v2 dialog anatomy and laid out as
 * the Payments document header: the `DialogHeader` row (the proposal's
 * icon, "Proposal · template", quiet, and Close), then the couple large
 * over the wedding and value (where it stands is the side column's first
 * line, not a badge here). More, Copy link and Nudge sit on the header row before
 * Close, the primary last. Nudge opens Zebri's drafted nudge first. Nudge is
 * the one primary while the couple is still deciding; a settled
 * proposal has none. More holds the rarer moves: Edit, Duplicate,
 * Extend expiry and Mark accepted (for a yes that came by phone),
 * Download PDF, and Withdraw in red.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/modal/proposal-header
 */

export interface ProposalHeaderProps {
  proposal: Proposal;
  state: ProposalsState;
  onNudge: () => void;
  onEdit: () => void;
  onClose: () => void;
}

/** The header. See {@link ProposalHeaderProps}. */
export function ProposalHeader({ proposal: p, state, onNudge, onEdit, onClose }: ProposalHeaderProps) {
  const out = p.group === 'opened' || p.group === 'unopened';
  const items: MoreItem[] = [
    // Live until accepted, frozen after (spec §3): an answered proposal is a record, not a draft.
    ...(p.group === 'accepted' || p.group === 'closed' ? [] : [{ label: 'Edit', run: onEdit }]),
    { label: 'Duplicate', run: () => undefined },
    ...(out ? [{ label: 'Extend expiry', run: () => state.extend(p.id) }, { label: 'Mark accepted', run: () => state.markAccepted(p.id) }] : []),
    { label: 'Download PDF', run: () => undefined },
    ...(out || p.group === 'draft' ? [{ label: 'Withdraw', run: () => state.withdraw(p.id), danger: true }] : []),
  ];
  return (
    <>
      <DialogHeader
        id="proposal-title"
        icon={ProposalIcon}
        title={`Proposal · ${templateOf(p.template).name}`}
        onClose={onClose}
        actions={
          <>
            <MoreMenu items={items} />
            {p.sentOn ? <CopyButton value={`https://zebri.app/p/${p.id}`} label="Copy link" /> : null}
            {out ? <Button onClick={onNudge}>Nudge</Button> : null}
          </>
        }
      />
      <div className="shrink-0 space-y-1 px-6 pb-6 pt-2 sm:px-10">
        <p id="proposal-couple" className="type-title text-zebra-950">
          {coupleName(p.names)}
        </p>
        <p className="type-body text-zebra-500">
          {weddingLine(p)} · {money(p.value)}
        </p>
      </div>
    </>
  );
}
