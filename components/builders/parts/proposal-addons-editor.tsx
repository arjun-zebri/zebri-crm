/**
 * Editable add-on list for one proposal option.
 *
 * Each row is an optional extra the couple can tick on the public
 * page: checkbox = the MC's **pre-tick** (`default_included` — the
 * couple can still change it), then description + amount inputs and a
 * remove button. Kept separate from {@link LineItemsTable} because
 * add-ons carry the pre-tick state base items don't have.
 *
 * @module components/builders/parts/proposal-addons-editor
 */
'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';

/** One add-on row under edit (id is a client key; saves re-insert). */
export interface ProposalAddOnDraft {
  id: string;
  description: string;
  amount: number;
  /** MC's pre-tick — what the couple sees selected by default. */
  defaultIncluded: boolean;
}

export interface ProposalAddOnsEditorProps {
  addOns: ProposalAddOnDraft[];
  canEdit: boolean;
  onChange: (next: ProposalAddOnDraft[]) => void;
}

const cellInput =
  'bg-transparent py-1.5 text-caption text-text placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed';

export function ProposalAddOnsEditor({ addOns, canEdit, onChange }: ProposalAddOnsEditorProps) {
  const update = (id: string, patch: Partial<ProposalAddOnDraft>) =>
    onChange(addOns.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-subtle">
        Optional add-ons
        <span className="ml-2 normal-case font-normal text-text-subtle">
          Ticked ones are pre-selected for the couple
        </span>
      </p>
      {addOns.map((addOn) => (
        <div
          key={addOn.id}
          className="grid grid-cols-[16px_1fr_96px_24px] items-center gap-2 border-b border-border"
        >
          <Checkbox
            checked={addOn.defaultIncluded}
            onChange={(checked) => update(addOn.id, { defaultIncluded: checked })}
            disabled={!canEdit}
            ariaLabel={`Pre-select ${addOn.description || 'add-on'}`}
          />
          <input
            type="text"
            value={addOn.description}
            onChange={(e) => update(addOn.id, { description: e.target.value })}
            placeholder="e.g., After-party hosting"
            disabled={!canEdit}
            className={`${cellInput} min-w-0`}
          />
          <div className="relative">
            <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-caption text-text-muted">
              +$
            </span>
            <input
              type="number"
              value={addOn.amount || ''}
              onChange={(e) => update(addOn.id, { amount: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              step="0.01"
              aria-label="Add-on amount"
              disabled={!canEdit}
              className={`${cellInput} w-full pl-6 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            />
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => onChange(addOns.filter((a) => a.id !== addOn.id))}
              className="flex cursor-pointer items-center justify-center text-text-subtle transition hover:text-danger"
              aria-label="Remove add-on"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {canEdit && (
        <button
          type="button"
          onClick={() =>
            onChange([
              ...addOns,
              { id: `new-${crypto.randomUUID()}`, description: '', amount: 0, defaultIncluded: false },
            ])
          }
          className="mt-1.5 flex cursor-pointer items-center gap-1 py-1 text-caption text-text-muted transition hover:text-text"
        >
          <Plus size={13} strokeWidth={1.5} />
          Add add-on
        </button>
      )}
    </div>
  );
}
