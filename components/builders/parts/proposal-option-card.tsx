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

import { Sparkles, Trash2 } from 'lucide-react';

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
  /** "Most popular" highlight — snapshotted from the package, editable
   *  per proposal. Rendered as a badge only when the proposal offers
   *  more than one option. */
  isPopular: boolean;
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
  /** Whether the "Most popular" toggle applies — only meaningful when
   *  the proposal offers more than one option (a lone package can't be
   *  "most popular" relative to nothing). */
  canFeature: boolean;
  canEdit: boolean;
  canRemove: boolean;
  onChange: (next: ProposalOptionDraft) => void;
  onRemove: () => void;
}

export function ProposalOptionCard({
  option,
  index,
  showIndex,
  canFeature,
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
    <div
      className={`rounded-xl border bg-card p-4 ${
        option.isPopular && canFeature ? 'border-brand-fg' : 'border-border'
      }`}
    >
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

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2.5">
        {/* Terms are a snapshot from the package — display-only here;
            they pre-fill the invoice when the accepted option converts. */}
        <span className="min-w-0 truncate text-xs text-text-muted">{terms.join(' · ')}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-text">
          {formatAUD(optionBaseTotal(option))}
        </span>
      </div>

      {/* Most-popular toggle — only offered when there's something to
          be popular relative to (>1 option). Snapshots default from
          the package but the MC can flip it per proposal. */}
      {canFeature && canEdit && (
        <button
          type="button"
          onClick={() => onChange({ ...option, isPopular: !option.isPopular })}
          className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-caption font-medium transition cursor-pointer ${
            option.isPopular
              ? 'border-brand-fg bg-brand-fg text-text-inverse'
              : 'border-border text-text-muted hover:text-text'
          }`}
          aria-pressed={option.isPopular}
        >
          <Sparkles size={13} strokeWidth={1.5} />
          {option.isPopular ? 'Most popular' : 'Mark as most popular'}
        </button>
      )}
    </div>
  );
}
