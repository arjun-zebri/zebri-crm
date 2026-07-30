/**
 * One row inside {@link TimeCategoryPicker}: select, rename, delete.
 *
 * The whole row is a single hover/selected surface. Putting the
 * background on the name button alone left the rename and delete icons
 * outside the highlight, which read as a half-painted row.
 *
 * Selection is carried by that surface plus a medium weight, with no
 * check icon: in a short single-select list the tint is unambiguous and
 * the icon only added noise beside the hover controls.
 *
 * Rename is inline rather than a nested dialog, because the picker is
 * already a popover and stacking a modal on top of it to change one word
 * would be heavier than the edit itself.
 *
 * @module components/time-tracking/time-category-row
 */
'use client';

import { Pencil, Trash2 } from 'lucide-react';
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
      <div className="flex items-center gap-1 px-1.5 py-0.5">
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
      </div>
    );
  }

  return (
    <div
      className={`group mx-1.5 flex items-center gap-0.5 rounded-lg pl-2 pr-1 transition ${
        selected ? 'bg-surface-emphasis' : 'hover:bg-surface-emphasis'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`min-w-0 flex-1 cursor-pointer truncate py-1.5 text-left text-caption transition ${
          selected ? 'font-medium text-text' : 'text-text-muted'
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
        className="shrink-0 cursor-pointer rounded-md p-1 text-text-subtle opacity-0 transition hover:text-text focus:opacity-100 group-hover:opacity-100"
      >
        <Pencil size={12} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${category.name}`}
        className="shrink-0 cursor-pointer rounded-md p-1 text-text-subtle opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100"
      >
        <Trash2 size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
}
