/**
 * One row inside {@link TimeCategoryPicker}: select, rename, delete.
 *
 * Rename is inline rather than a nested dialog, because the picker is
 * already a popover and stacking a modal on top of it to change one word
 * would be heavier than the edit itself.
 *
 * @module components/time-tracking/time-category-row
 */
'use client';

import { Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import type { TimeCategory } from '@/types/time-tracking';

export interface TimeCategoryRowProps {
  category: TimeCategory;
  /** True when this row is the picker's current value. */
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function TimeCategoryRow({
  category,
  selected,
  onSelect,
  onRename,
  onDelete,
}: TimeCategoryRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    // An empty or unchanged name is a no-op, not an error worth a toast.
    if (!next || next === category.name) {
      setDraft(category.name);
      return;
    }
    onRename(next);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <Input
          autoFocus
          size="sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(category.name);
              setEditing(false);
            }
          }}
          aria-label={`Rename ${category.name}`}
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={commit}
          aria-label={`Save ${category.name}`}
          className="shrink-0 cursor-pointer rounded-lg p-1 text-text-subtle transition hover:bg-surface-emphasis hover:text-text"
        >
          <Check size={13} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1 px-1">
      <button
        type="button"
        onClick={onSelect}
        className={`min-w-0 flex-1 cursor-pointer truncate rounded-lg px-2 py-1.5 text-left text-caption transition ${
          selected
            ? 'bg-surface-emphasis font-medium text-text'
            : 'text-text-muted hover:bg-surface-emphasis hover:text-text'
        }`}
      >
        {category.name}
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(category.name);
          setEditing(true);
        }}
        aria-label={`Rename ${category.name}`}
        className="shrink-0 cursor-pointer rounded-lg p-1 text-text-subtle opacity-0 transition group-hover:opacity-100 hover:bg-surface-emphasis hover:text-text focus:opacity-100"
      >
        <Pencil size={12} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${category.name}`}
        className="shrink-0 cursor-pointer rounded-lg p-1 text-text-subtle opacity-0 transition group-hover:opacity-100 hover:bg-surface-emphasis hover:text-danger focus:opacity-100"
      >
        <Trash2 size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
}
