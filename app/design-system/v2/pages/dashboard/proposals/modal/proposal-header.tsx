'use client';

import { MoreHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { coupleName, money } from '../../payments/payments-data';
import { weddingLine, type Proposal } from '../proposals-data';
import { templateOf } from '../templates-data';
import type { ProposalsState } from '../use-proposals-state';

/**
 * The proposal modal's header, one row, to the user's mockup: the
 * couple over the template, wedding and value on the left (where it
 * stands is the side column's first line, not a badge here); Copy link
 * and Nudge on the right, then More and Close past a hairline. Nudge is
 * the one primary while the couple is still deciding; a settled
 * proposal has none. More holds the rarer moves: Edit, Duplicate,
 * Extend expiry and Mark accepted (for a yes that came by phone),
 * Download PDF, and Withdraw in red. On phones the actions wrap under the title.
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
  const [menu, setMenu] = useState(false);
  const out = p.group === 'opened' || p.group === 'unopened';
  const items: { label: string; run: () => void; danger?: boolean }[] = [
    { label: 'Edit', run: onEdit },
    { label: 'Duplicate', run: () => undefined },
    ...(out ? [{ label: 'Extend expiry', run: () => state.extend(p.id) }, { label: 'Mark accepted', run: () => state.markAccepted(p.id) }] : []),
    { label: 'Download PDF', run: () => undefined },
    ...(out || p.group === 'draft' ? [{ label: 'Withdraw', run: () => state.withdraw(p.id), danger: true }] : []),
  ];
  return (
    <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id="proposal-title" className="type-title text-zebra-950">
          {coupleName(p.names)}
        </h2>
        <p className="type-body text-zebra-500">
          {templateOf(p.template).name} · {weddingLine(p)} · {money(p.value)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 max-sm:order-last max-sm:w-full">
        {p.sentOn ? <CopyButton value={`https://zebri.app/p/${p.id}`} label="Copy link" /> : null}
        {out ? <Button onClick={onNudge}>Nudge</Button> : null}
      </div>
      <div className="flex items-center gap-1 sm:border-l sm:border-zebra-950/5 sm:pl-4">
        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger asChild>
            <Button variant="ghost" square aria-label="More">
              <MoreHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent size="menu" align="end" role="menu" aria-label="More">
            {items.map((item) => (
              <MenuOption
                key={item.label}
                onSelect={() => {
                  item.run();
                  setMenu(false);
                }}
              >
                <span className={item.danger ? 'text-danger' : undefined}>{item.label}</span>
              </MenuOption>
            ))}
          </PopoverContent>
        </Popover>
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </div>
    </header>
  );
}
