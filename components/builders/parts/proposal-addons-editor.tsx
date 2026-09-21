/**
 * Add-on lines per option. Add-ons are the items the couple toggles on the
 * public page; `defaultIncluded` is the MC's pre-tick. A travel fee is
 * added here as a free-form add-on (D12).
 *
 * @module components/builders/parts/proposal-addons-editor
 */
'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types';

export interface ProposalAddonsEditorProps {
  options: ProposalOptionInput[];
  canEdit: boolean;
  onChange: (options: ProposalOptionInput[]) => void;
}

/** Editor for the add-on lines under each option. See {@link ProposalAddonsEditorProps}. */
export function ProposalAddonsEditor({ options, canEdit, onChange }: ProposalAddonsEditorProps) {
  if (options.length === 0) return null;
  const setItems = (optId: string, items: ProposalItemInput[]) =>
    onChange(options.map((o) => (o.id === optId ? { ...o, items } : o)));
  const add = (o: ProposalOptionInput) =>
    setItems(o.id, [
      ...o.items,
      { id: `new-${crypto.randomUUID()}`, description: '', note: null, amount: 0, quantity: 1, isAddon: true, defaultIncluded: false, position: o.items.length + 1 },
    ]);
  return (
    <div className="space-y-3">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Optional add-ons</h4>
      {options.map((o) => (
        <div key={o.id} className="space-y-1">
          <p className="text-body text-text">{o.title || 'Untitled option'}</p>
          {o.items
            .filter((i) => i.isAddon)
            .map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <Checkbox
                  checked={i.defaultIncluded}
                  onChange={(v) => setItems(o.id, o.items.map((x) => (x.id === i.id ? { ...x, defaultIncluded: v } : x)))}
                  disabled={!canEdit}
                  label={<span className="sr-only">Pre-selected</span>}
                />
                <Input
                  value={i.description}
                  onChange={(e) => setItems(o.id, o.items.map((x) => (x.id === i.id ? { ...x, description: e.target.value } : x)))}
                  placeholder="Add-on (e.g. Travel fee)"
                  disabled={!canEdit}
                  aria-label="Add-on description"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  value={i.amount}
                  onChange={(e) => setItems(o.id, o.items.map((x) => (x.id === i.id ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
                  disabled={!canEdit}
                  aria-label="Add-on amount"
                  className="w-28"
                />
                {canEdit ? (
                  <Button variant="ghost" iconOnly aria-label="Remove add-on" onClick={() => setItems(o.id, o.items.filter((x) => x.id !== i.id))}>
                    <Trash2 size={14} strokeWidth={1.5} />
                  </Button>
                ) : null}
              </div>
            ))}
          {canEdit ? (
            <Button variant="ghost" onClick={() => add(o)} className="gap-1.5">
              <Plus size={14} strokeWidth={1.5} /> Add add-on
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
