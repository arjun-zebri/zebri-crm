/**
 * Optional "Link to quote" picker for the contract builder.
 *
 * Linking a quote to a contract drives two pieces of downstream
 * behaviour:
 * - The contract body can reference `{{total_amount}}` /
 *   `{{deposit_amount}}` which come from the linked quote.
 * - When the contract is signed AND the linked quote was already
 *   accepted, `sign_contract` auto-creates a deposit invoice.
 *
 * Popover with a search input + selectable list — same style as the
 * couple picker in `builder-meta-row.tsx`. Native `<select>` was
 * the previous implementation; Popover wins for accessibility on
 * mobile + matches the rest of the builder modals.
 *
 * @module components/builders/parts/contract-quote-link
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, FileText, Search } from 'lucide-react';
import { useState } from 'react';

export interface ContractQuoteLinkOption {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  subtotal: number;
}

export interface ContractQuoteLinkProps {
  selectedQuoteId: string | null;
  options: ContractQuoteLinkOption[];
  canEdit: boolean;
  onSelect: (id: string | null) => void;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(n);
}

export function ContractQuoteLink({
  selectedQuoteId,
  options,
  canEdit,
  onSelect,
}: ContractQuoteLinkProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const selected = options.find((q) => q.id === selectedQuoteId) ?? null;

  const filtered = filter
    ? options.filter(
        (q) =>
          q.quote_number.toLowerCase().includes(filter.toLowerCase()) ||
          (q.title ?? '').toLowerCase().includes(filter.toLowerCase()),
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
          <FileText
            size={14}
            strokeWidth={1.5}
            className="text-text-subtle shrink-0"
          />
          <span className="flex-1 truncate text-left">
            {selected ? (
              <>
                {selected.quote_number}
                <span className="text-text-subtle"> · {selected.title}</span>
              </>
            ) : (
              <span className="text-text-subtle">Link to quote</span>
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
              placeholder="Search quotes…"
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
                selectedQuoteId === null
                  ? 'bg-surface-muted text-text'
                  : 'text-text-muted'
              }`}
            >
              None
            </button>
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-caption text-text-subtle">
                No quotes match.
              </p>
            ) : (
              filtered.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    onSelect(q.id);
                    setOpen(false);
                    setFilter('');
                  }}
                  className={`block w-full rounded-control px-2 py-1.5 text-left transition-colors hover:bg-surface-muted cursor-pointer ${
                    q.id === selectedQuoteId
                      ? 'bg-surface-muted text-text'
                      : 'text-text'
                  }`}
                >
                  <p className="text-body">
                    {q.quote_number}
                    <span className="text-text-subtle"> · {q.title || 'Untitled'}</span>
                  </p>
                  <p className="text-caption text-text-muted">
                    {q.status} · {formatCurrency(q.subtotal)}
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
