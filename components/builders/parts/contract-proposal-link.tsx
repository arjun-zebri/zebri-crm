/**
 * Optional "Link to proposal" picker for the contract builder.
 *
 * Linking a proposal to a contract drives two pieces of downstream
 * behaviour:
 * - The contract body can reference `{{total_amount}}` /
 *   `{{deposit_amount}}` which come from the linked proposal.
 * - When the contract is signed AND the linked proposal was already
 *   accepted, `sign_contract` auto-creates a deposit invoice.
 *
 * Popover with a search input + selectable list — same style as the
 * couple picker in `builder-meta-row.tsx`. Native `<select>` was
 * the previous implementation; Popover wins for accessibility on
 * mobile + matches the rest of the builder modals.
 *
 * @module components/builders/parts/contract-proposal-link
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, PackageOpen, Search } from 'lucide-react';
import { useState } from 'react';

export interface ContractProposalLinkOption {
  id: string;
  proposal_number: string;
  title: string;
  status: string;
  subtotal: number;
}

export interface ContractProposalLinkProps {
  selectedProposalId: string | null;
  options: ContractProposalLinkOption[];
  canEdit: boolean;
  onSelect: (id: string | null) => void;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(n);
}

export function ContractProposalLink({
  selectedProposalId,
  options,
  canEdit,
  onSelect,
}: ContractProposalLinkProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const selected = options.find((p) => p.id === selectedProposalId) ?? null;

  const filtered = filter
    ? options.filter(
        (p) =>
          p.proposal_number.toLowerCase().includes(filter.toLowerCase()) ||
          (p.title ?? '').toLowerCase().includes(filter.toLowerCase()),
      )
    : options;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={!canEdit}
          className="inline-flex w-64 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1.5 text-body text-text hover:bg-surface-muted transition-colors disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
        >
          <PackageOpen
            size={14}
            strokeWidth={1.5}
            className="text-text-subtle shrink-0"
          />
          <span className="flex-1 truncate text-left">
            {selected ? (
              <>
                {selected.proposal_number}
                <span className="text-text-subtle"> · {selected.title}</span>
              </>
            ) : (
              <span className="text-text-subtle">Link to proposal</span>
            )}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className="text-text-subtle shrink-0"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[90] w-72 rounded-card border border-border bg-surface shadow-lg p-2 animate-fade-in"
        >
          <div className="relative mb-2">
            <Search
              size={11}
              strokeWidth={1.5}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
            />
            <input
              type="text"
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search proposals…"
              className="w-full rounded-control border border-border bg-surface pl-6 pr-2 py-1.5 text-caption text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {/* "Unlink" / "None" — surfaces above the list so it's a
                one-tap reset when an MC changes their mind about
                linking. */}
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setOpen(false);
                setFilter('');
              }}
              className={`block w-full rounded-control px-2 py-1.5 text-left text-body transition-colors hover:bg-surface-muted cursor-pointer ${
                selectedProposalId === null
                  ? 'bg-surface-muted text-text'
                  : 'text-text-muted'
              }`}
            >
              None
            </button>
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-caption text-text-subtle">
                No proposals match.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                    setFilter('');
                  }}
                  className={`block w-full rounded-control px-2 py-1.5 text-left transition-colors hover:bg-surface-muted cursor-pointer ${
                    p.id === selectedProposalId
                      ? 'bg-surface-muted text-text'
                      : 'text-text'
                  }`}
                >
                  <p className="text-body">
                    {p.proposal_number}
                    <span className="text-text-subtle"> · {p.title || 'Untitled'}</span>
                  </p>
                  <p className="text-caption text-text-muted">
                    {p.status} · {formatCurrency(p.subtotal)}
                  </p>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
