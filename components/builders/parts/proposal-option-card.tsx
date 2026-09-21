/**
 * One package option card inside {@link ProposalOptionsEditor}: title,
 * popular flag, description, pricing terms, and its base (non-add-on)
 * line items, each addable and removable the same way the add-ons below
 * it are.
 *
 * Split out of `proposal-options-editor.tsx` to keep both files under the
 * ~150-line component limit; the pricing terms row is further split into
 * {@link ProposalOptionTerms} for the same reason.
 *
 * @module components/builders/parts/proposal-option-card
 */
'use client';

import { Plus, Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { optionTotal } from '@/lib/proposals/pricing';
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types';

import { ProposalOptionTerms } from './proposal-option-terms';

export interface ProposalOptionCardProps {
  option: ProposalOptionInput;
  canEdit: boolean;
  onPatch: (patch: Partial<ProposalOptionInput>) => void;
  onPatchItem: (itemId: string, patch: Partial<ProposalItemInput>) => void;
  /** Appends a blank base line item (see `ProposalOptionsEditor.addItem`). */
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onRemove: () => void;
  /** Forwarded straight from `Toggle`'s `onChange`: `true` makes this
   *  option the popular one (clearing any other), `false` clears it. */
  onSetPopular: (checked: boolean) => void;
}

const money = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;

/** See {@link ProposalOptionCardProps}. */
export function ProposalOptionCard({
  option,
  canEdit,
  onPatch,
  onPatchItem,
  onAddItem,
  onRemoveItem,
  onRemove,
  onSetPopular,
}: ProposalOptionCardProps) {
  // In single-price mode a line item's amount is ignored (pricing.ts
  // treats items as inclusions only, priced by fixedPrice), so the field
  // is disabled here rather than left editable with no visible effect.
  const isSingle = option.pricingMode === 'single';
  return (
    <div className="rounded-control border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={option.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Option name"
          disabled={!canEdit}
          aria-label="Option name"
        />
        <Toggle
          checked={option.isPopular}
          onChange={onSetPopular}
          disabled={!canEdit}
          label={
            <span className="flex items-center gap-1">
              <Star size={14} strokeWidth={1.5} /> Popular
            </span>
          }
        />
        {canEdit ? (
          <Button variant="ghost" iconOnly aria-label="Remove option" onClick={onRemove}>
            <Trash2 size={14} strokeWidth={1.5} />
          </Button>
        ) : null}
      </div>
      <Textarea
        value={option.description ?? ''}
        onChange={(e) => onPatch({ description: e.target.value || null })}
        placeholder="What this package includes"
        rows={2}
        disabled={!canEdit}
        aria-label="Option description"
      />
      <ProposalOptionTerms option={option} canEdit={canEdit} onPatch={onPatch} />
      <ul className="space-y-1">
        {option.items
          .filter((i) => !i.isAddon)
          .map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <Input
                value={i.description}
                onChange={(e) => onPatchItem(i.id, { description: e.target.value })}
                disabled={!canEdit}
                aria-label="Line description"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={i.amount}
                onChange={(e) => onPatchItem(i.id, { amount: Number(e.target.value) || 0 })}
                disabled={!canEdit || isSingle}
                aria-label="Line amount"
                className="w-28"
              />
              {canEdit ? (
                <Button variant="ghost" iconOnly aria-label="Remove line item" onClick={() => onRemoveItem(i.id)}>
                  <Trash2 size={14} strokeWidth={1.5} />
                </Button>
              ) : null}
            </li>
          ))}
      </ul>
      {canEdit ? (
        <Button variant="ghost" onClick={onAddItem} className="gap-1.5">
          <Plus size={14} strokeWidth={1.5} /> Add item
        </Button>
      ) : null}
      {/* Includes weekend loading, so "Base" would understate it; add-ons are excluded (empty selection). */}
      <p className="text-body text-text-muted text-right">Total {money(optionTotal(option, []))}</p>
    </div>
  );
}
