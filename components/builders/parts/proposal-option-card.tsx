/**
 * One package option inside the proposal composer.
 *
 * A bordered card owning everything the couple will compare between
 * options: an editable title + description, the base line items
 * (shared {@link LineItemsTable}), the optional add-ons with their
 * pre-ticks ({@link ProposalAddOnsEditor}), and a footer showing the
 * base total plus the snapshotted commercial terms (deposit %, GST
 * treatment, weekend loading) that carry through to the invoice.
 *
 * @module components/builders/parts/proposal-option-card
 */
'use client';

import { Trash2 } from 'lucide-react';

import { formatAUD } from '@/lib/payments/format';

import { type LineItem, LineItemsTable } from './line-items-table';
import { type ProposalAddOnDraft, ProposalAddOnsEditor } from './proposal-addons-editor';

/** One option under edit (key is a client key; saves re-insert). */
export interface ProposalOptionDraft {
  key: string;
  title: string;
  description: string | null;
  /** Provenance: the package this option snapshotted from. */
  sourcePackageId: string | null;
  /** Commercial terms snapshotted from the package at apply time. */
  depositPercent: number | null;
  gstInclusive: boolean;
  weekendLoadingPercent: number | null;
  items: LineItem[];
  addOns: ProposalAddOnDraft[];
}

/** Base-items total (add-ons are extras the couple picks). */
export function optionBaseTotal(option: ProposalOptionDraft): number {
  return option.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

export interface ProposalOptionCardProps {
  option: ProposalOptionDraft;
  index: number;
  /** Hide the "Option N" label when the proposal has a single option. */
  showIndex: boolean;
  canEdit: boolean;
  canRemove: boolean;
  onChange: (next: ProposalOptionDraft) => void;
  onRemove: () => void;
}

export function ProposalOptionCard({
  option,
  index,
  showIndex,
  canEdit,
  canRemove,
  onChange,
  onRemove,
}: ProposalOptionCardProps) {
  const terms: string[] = [];
  if (option.depositPercent) terms.push(`${String(option.depositPercent)}% deposit`);
  terms.push(option.gstInclusive ? 'GST incl.' : '+ GST');
  if (option.weekendLoadingPercent) terms.push(`weekend +${String(option.weekendLoadingPercent)}%`);

  const patchItems = (mutate: (prev: LineItem[]) => LineItem[]) =>
    onChange({ ...option, items: mutate(option.items) });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showIndex && (
            <p className="text-xs font-medium uppercase tracking-wide text-brand">
              Option {index + 1}
            </p>
          )}
          <input
            type="text"
            value={option.title}
            onChange={(e) => onChange({ ...option, title: e.target.value })}
            placeholder="Package name the couple sees"
            disabled={!canEdit}
            aria-label={`Option ${String(index + 1)} title`}
            className="mt-0.5 w-full bg-transparent text-base font-semibold text-text placeholder:font-normal placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed"
          />
          <input
            type="text"
            value={option.description ?? ''}
            onChange={(e) => onChange({ ...option, description: e.target.value || null })}
            placeholder="One-line pitch shown under the name (optional)"
            disabled={!canEdit}
            aria-label={`Option ${String(index + 1)} description`}
            className="mt-0.5 w-full bg-transparent text-caption text-text-muted placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
        {canEdit && canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 cursor-pointer p-1 text-text-subtle transition hover:text-danger"
            aria-label={`Remove option ${String(index + 1)}`}
          >
            <Trash2 size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">Included</p>
        <LineItemsTable
          items={option.items}
          compact
          canEdit={canEdit}
          onUpdate={(id, field, value) =>
            patchItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
          }
          onRemove={(id) => patchItems((prev) => prev.filter((i) => i.id !== id))}
          onReorder={(next) => patchItems(() => next)}
          onAdd={() =>
            patchItems((prev) => [
              ...prev,
              { id: `new-${crypto.randomUUID()}`, description: '', amount: 0, position: prev.length },
            ])
          }
        />
      </div>

      <div className="mt-4">
        <ProposalAddOnsEditor
          addOns={option.addOns}
          canEdit={canEdit}
          onChange={(addOns) => onChange({ ...option, addOns })}
        />
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-2.5">
        {/* Terms are a snapshot from the package — display-only here;
            they pre-fill the invoice when the accepted option converts. */}
        <span className="min-w-0 truncate text-xs text-text-muted">{terms.join(' · ')}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-text">
          {formatAUD(optionBaseTotal(option))}
        </span>
      </div>
    </div>
  );
}
