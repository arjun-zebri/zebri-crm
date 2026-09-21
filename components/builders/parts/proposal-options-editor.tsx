/**
 * The 1-3 package options on a proposal. Each is a snapshot picked from
 * the packages library, started blank, or edited in place: title,
 * description, popular flag, pricing terms, and its base line items.
 *
 * @module components/builders/parts/proposal-options-editor
 */
'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { blankOption } from '@/lib/proposals/form-factories';
import { MAX_OPTIONS } from '@/lib/proposals/schemas';
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types';

import { ProposalOptionCard } from './proposal-option-card';
import { TemplatePicker } from './template-picker';
import type { ApplySources } from './use-apply-sources';

export interface ProposalOptionsEditorProps {
  options: ProposalOptionInput[];
  sources: ApplySources | undefined;
  canEdit: boolean;
  onChange: (options: ProposalOptionInput[]) => void;
  /** Resolve a picked source id to a new option (see applyPackageToOption). */
  onApplySource: (sourceId: string) => void;
}

/** Editor for the proposal's package options. See {@link ProposalOptionsEditorProps}. */
export function ProposalOptionsEditor({ options, sources, canEdit, onChange, onApplySource }: ProposalOptionsEditorProps) {
  const patch = (id: string, p: Partial<ProposalOptionInput>) =>
    onChange(options.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const patchItem = (optId: string, itemId: string, p: Partial<ProposalItemInput>) =>
    onChange(options.map((o) => (o.id === optId ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, ...p } : i)) } : o)));
  // Mirrors the add-on editor's new-item shape; defaultIncluded is true
  // here because a base item is included by definition, unlike an add-on.
  const addItem = (optId: string) =>
    onChange(
      options.map((o) =>
        o.id === optId
          ? {
              ...o,
              items: [
                ...o.items,
                {
                  id: `new-${crypto.randomUUID()}`,
                  description: '',
                  note: null,
                  amount: 0,
                  quantity: 1,
                  isAddon: false,
                  defaultIncluded: true,
                  position: o.items.length + 1,
                },
              ],
            }
          : o,
      ),
    );
  const removeItem = (optId: string, itemId: string) =>
    onChange(options.map((o) => (o.id === optId ? { ...o, items: o.items.filter((i) => i.id !== itemId) } : o)));
  const removeOption = (id: string) =>
    onChange(options.filter((o) => o.id !== id).map((o, idx) => ({ ...o, position: idx + 1 })));
  // Honours the toggle's own value: switching one option's Popular off
  // clears the flag with nothing else becoming popular in its place;
  // switching one on clears every other option's flag.
  const setPopular = (id: string, checked: boolean) =>
    onChange(options.map((o) => ({ ...o, isPopular: checked && o.id === id })));
  const addBlank = () => onChange([...options, blankOption(options.length + 1)]);

  const canAddMore = canEdit && options.length < MAX_OPTIONS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Package options</h4>
        {canAddMore ? (
          <div className="flex items-center gap-3">
            <TemplatePicker variant="inline" templates={sources?.options ?? []} canApply onApply={onApplySource} />
            <Button variant="ghost" onClick={addBlank} className="gap-1.5">
              <Plus size={14} strokeWidth={1.5} /> Blank option
            </Button>
          </div>
        ) : null}
      </div>
      {options.length === 0 ? (
        <p className="text-body text-text-muted">Add up to {MAX_OPTIONS} packages for the couple to choose from.</p>
      ) : null}
      {options.map((o) => (
        <ProposalOptionCard
          key={o.id}
          option={o}
          canEdit={canEdit}
          onPatch={(p) => patch(o.id, p)}
          onPatchItem={(itemId, p) => patchItem(o.id, itemId, p)}
          onAddItem={() => addItem(o.id)}
          onRemoveItem={(itemId) => removeItem(o.id, itemId)}
          onRemove={() => removeOption(o.id)}
          onSetPopular={(checked) => setPopular(o.id, checked)}
        />
      ))}
    </div>
  );
}
