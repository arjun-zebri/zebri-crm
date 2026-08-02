/**
 * Document meta row — couple picker + optional date / terms.
 *
 * Used by both Quote (couple + expiry) and Invoice (couple +
 * payment terms + due date). All controls are self-describing
 * (icon + placeholder); no labels above to keep the row calm.
 *
 * The couple picker is a popover-anchored search list. Keeping the
 * same Popover-based pattern the previous modal used means the
 * existing tab-order + keyboard semantics carry over.
 *
 * @module components/builders/parts/builder-meta-row
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search, User } from 'lucide-react';
import { useState } from 'react';

import { DatePicker } from '@/components/ui/date-picker';

export interface CoupleOption {
  id: string;
  name: string;
  /** Contact addresses, carried so the builder can show the couple the
   *  document will actually be emailed to. Optional: pickers that only
   *  need id + name can leave them off. */
  primary_email?: string | null;
  email?: string | null;
}

export type PaymentTerms =
  | ''
  | 'due_on_receipt'
  | 'net_7'
  | 'net_14'
  | 'net_30'
  | 'custom';

export interface BuilderMetaRowProps {
  /** Currently selected couple. `null` when nothing is set. */
  selectedCoupleId: string | null;
  selectedCoupleName: string | null;
  /** Full list of the user's couples for the search picker. */
  coupleOptions: CoupleOption[];
  canEditCouple: boolean;
  onSelectCouple: (couple: CoupleOption) => void;
  /** Optional second field — used by invoices for payment terms,
   *  hidden on quotes. */
  paymentTerms?: PaymentTerms;
  onPaymentTermsChange?: (next: PaymentTerms) => void;
  /** Trailing date field. `dateLabel` is the empty-state placeholder
   *  (e.g. "Set expiry date"). `datePrefix` (optional) prepends to
   *  the formatted date when a value is set (e.g. "Expires 31 May
   *  2026") so the field's purpose stays obvious. */
  dateValue: string | null;
  dateLabel: string;
  datePrefix?: string;
  onDateChange: (next: string | null) => void;
  canEdit: boolean;
}

const PAYMENT_TERMS_OPTIONS: { value: PaymentTerms; label: string }[] = [
  { value: '', label: 'No terms' },
  { value: 'due_on_receipt', label: 'Due on receipt' },
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_14', label: 'Net 14' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'custom', label: 'Custom' },
];

export function BuilderMetaRow({
  selectedCoupleId,
  selectedCoupleName,
  coupleOptions,
  canEditCouple,
  onSelectCouple,
  paymentTerms,
  onPaymentTermsChange,
  dateValue,
  dateLabel,
  datePrefix,
  onDateChange,
  canEdit,
}: BuilderMetaRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-body">
      {/* Couple picker */}
      <CouplePicker
        selectedCoupleId={selectedCoupleId}
        selectedCoupleName={selectedCoupleName}
        coupleOptions={coupleOptions}
        canEdit={canEditCouple}
        onSelect={onSelectCouple}
      />

      {/* Payment terms (invoices only) */}
      {paymentTerms !== undefined && onPaymentTermsChange ? (
        <TermsPicker
          value={paymentTerms}
          onChange={onPaymentTermsChange}
          canEdit={canEdit}
        />
      ) : null}

      {/* Date — `meta` variant + left icon so the trigger reads as a
          sibling of the couple picker / terms picker. */}
      <DatePicker
        value={dateValue ?? ''}
        onChange={(next) => onDateChange(next || null)}
        placeholder={dateLabel}
        disabled={!canEdit}
        iconPosition="left"
        variant="meta"
        {...(datePrefix ? { displayPrefix: datePrefix } : {})}
      />
    </div>
  );
}

/* ─── Couple picker ────────────────────────────────────────────── */

function CouplePicker({
  selectedCoupleId,
  selectedCoupleName,
  coupleOptions,
  canEdit,
  onSelect,
}: {
  selectedCoupleId: string | null;
  selectedCoupleName: string | null;
  coupleOptions: CoupleOption[];
  canEdit: boolean;
  onSelect: (c: CoupleOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = coupleOptions.filter((c) =>
    !filter ? true : c.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={!canEdit}
          // Fixed width so swapping couples doesn't reflow the row.
          // Matches the popover width below for visual continuity.
          className="inline-flex w-56 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1.5 text-body text-text hover:bg-surface-muted transition-colors disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
        >
          <User size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
          <span className="flex-1 truncate text-left">
            {selectedCoupleName ?? (
              <span className="text-text-subtle">Select couple</span>
            )}
          </span>
          <ChevronDown size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          // `w-56` matches the trigger so the popover doesn't "jump"
          // wider than the button.
          className="z-[90] w-56 rounded-card border border-border bg-surface shadow-lg p-2 animate-fade-in"
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
              placeholder="Search couples…"
              className="w-full rounded-control border border-border bg-surface pl-6 pr-2 py-1.5 text-caption text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-caption text-text-subtle">
                No couples match.
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setFilter('');
                  }}
                  className={`block w-full rounded-control px-2 py-1.5 text-left text-body transition-colors hover:bg-surface-muted cursor-pointer ${
                    c.id === selectedCoupleId ? 'bg-surface-muted text-text' : 'text-text'
                  }`}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ─── Payment terms picker ─────────────────────────────────────── */

function TermsPicker({
  value,
  onChange,
  canEdit,
}: {
  value: PaymentTerms;
  onChange: (next: PaymentTerms) => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = PAYMENT_TERMS_OPTIONS.find((o) => o.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={!canEdit}
          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1.5 text-body text-text hover:bg-surface-muted transition-colors disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
        >
          {current?.label ?? 'Terms'}
          <ChevronDown size={14} strokeWidth={1.5} className="text-text-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[90] w-44 rounded-card border border-border bg-surface shadow-lg p-1 animate-fade-in"
        >
          {PAYMENT_TERMS_OPTIONS.map((o) => (
            <button
              key={o.value || 'none'}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`block w-full rounded-control px-2 py-1.5 text-left text-body transition-colors hover:bg-surface-muted cursor-pointer ${
                o.value === value ? 'text-text font-medium' : 'text-text-muted'
              }`}
            >
              {o.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
