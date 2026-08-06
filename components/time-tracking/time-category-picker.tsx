/**
 * Type-to-create category picker for a time entry.
 *
 * Filters the user's categories as they type and offers
 * `Create "<typed>"` when nothing matches, so labelling a session never
 * requires a detour into settings.
 *
 * Each row carries a colour swatch that opens the same picker branding
 * uses. Categories were originally plain text so as not to compete with
 * the couple statuses, but that reasoning applied to a fixed app palette;
 * a colour the MC chooses is their own vocabulary, and the Time tab's
 * breakdown bar needs segments a reader can tell apart.
 *
 * @module components/time-tracking/time-category-picker
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';

import { TimeCategoryRow } from './time-category-row';
import { useTimeCategories } from './use-time-categories';

export interface TimeCategoryPickerProps {
  /** Currently selected category id, or null for uncategorised. */
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

export function TimeCategoryPicker({ value, onChange }: TimeCategoryPickerProps) {
  const { categories, create, rename, recolor, remove } = useTimeCategories();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Name of a category being created right now. The trigger shows it
  // immediately; `value` only ever holds a real id, so saving during that
  // window can never send a placeholder to the server.
  const [pendingName, setPendingName] = useState<string | null>(null);

  const trimmed = query.trim();
  const filtered = trimmed
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(trimmed.toLowerCase()),
      )
    : categories;
  // Only offer Create when the typed name is genuinely new: retyping an
  // existing name should select it, not appear to make a duplicate.
  const canCreate =
    trimmed.length > 0 &&
    !categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  const selected = categories.find((c) => c.id === value);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const select = (categoryId: string | null) => {
    onChange(categoryId);
    close();
  };

  const handleCreate = () => {
    const name = trimmed;
    setPendingName(name);
    close();
    void create(name).then((created) => {
      setPendingName(null);
      if (created) onChange(created.id);
    });
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          // Deliberately the `Input size="sm"` geometry — 32px tall,
          // control radius, 2.5 padding — so the trigger reads as a
          // sibling of the date and duration fields it sits between
          // rather than a rounder, taller control of its own.
          className="flex h-8 w-56 max-w-full cursor-pointer items-center justify-between gap-2 rounded-control border border-border bg-surface px-2.5 text-left text-caption transition hover:bg-surface-muted"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {selected?.color ? (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-pill ring-1 ring-black/10"
                style={{ background: selected.color }}
              />
            ) : null}
            <span
              className={
                selected || pendingName
                  ? 'truncate text-text'
                  : 'text-text-subtle'
              }
            >
              {pendingName ?? selected?.name ?? 'Add category'}
            </span>
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className="shrink-0 text-text-subtle"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="z-[95] w-[var(--radix-popover-trigger-width)] rounded-control border border-border bg-card py-1 shadow-lg"
        >
          <div className="px-2 pb-1 pt-1">
            <Input
              autoFocus
              size="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // The field both filters and creates, so the placeholder
              // says so: "Search categories" hid the type-to-create
              // affordance behind typing something that matched nothing.
              placeholder="Search or add new"
              aria-label="Search or add new"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((category) => (
              <TimeCategoryRow
                key={category.id}
                category={category}
                selected={category.id === value}
                onSelect={() => select(category.id)}
                onRename={(name) => rename(category.id, name)}
                onRecolor={(color) => recolor(category.id, color)}
                onDelete={() => {
                  remove(category.id);
                  // The entry keeps its history but loses the label, so
                  // the picker must not keep showing a dead selection.
                  if (category.id === value) onChange(null);
                }}
              />
            ))}
            {filtered.length === 0 && !canCreate ? (
              <p className="px-3.5 py-2 text-caption text-text-subtle">
                No categories yet.
              </p>
            ) : null}
          </div>

          {canCreate ? (
            <div className="border-t border-border pt-1">
              <button
                type="button"
                onClick={handleCreate}
                className="mx-1.5 flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-left text-caption text-text-muted transition hover:bg-surface-emphasis hover:text-text"
              >
                <Plus size={13} strokeWidth={1.5} />
                <span className="truncate">Create &quot;{trimmed}&quot;</span>
              </button>
            </div>
          ) : null}

          {value ? (
            <div className="border-t border-border pt-1">
              <button
                type="button"
                onClick={() => select(null)}
                className="mx-1.5 flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-left text-caption text-text-subtle transition hover:bg-surface-emphasis hover:text-text"
              >
                <X size={13} strokeWidth={1.5} />
                Clear
              </button>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
