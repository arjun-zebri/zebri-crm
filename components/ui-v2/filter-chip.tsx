'use client';

import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from './button';
import { Checkbox } from './checkbox';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/**
 * Design system v2 filter chip (preview): one multi-select filter on a
 * view, the way a dashboarding tool shows them, for a list that can grow
 * (every service an MC offers) where a segmented row would overflow.
 *
 * With nothing picked it is a quiet dashed chip naming what it filters
 * ("+ Service"), or, given `placeholder`, a quiet filled chip that says
 * what is shown now ("Service  All services"), for a chart where "no
 * filter" is itself the view being read. Picked, it becomes a filled chip with the filter and
 * what is in it ("Service  MC, Celebrant", or "Service  3 selected" once
 * the names would crowd it) and a × that clears it. The chip opens a
 * menu with a search box over a list of checkboxes; the menu stays open
 * while options are ticked, and Clear under the list empties it.
 *
 * @example
 * ```tsx
 * <FilterChip label="Service" options={[{ value: 'mc', label: 'MC' }]} value={services} onChange={setServices} />
 * ```
 *
 * @module components/ui-v2/filter-chip
 */

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterChipProps {
  /** What it filters, on the chip and the menu: "Service". */
  label: string;
  options: FilterOption[];
  /** The ticked options; empty for no filter. */
  value: string[];
  onChange: (value: string[]) => void;
  /** What the chip says with nothing picked, "All services"; swaps the dashed "+ label" for a filled chip. */
  placeholder?: string | undefined;
}

const CHIP =
  'inline-flex h-9 items-center gap-1.5 rounded-panel px-3 type-label transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none';

/** Up to this many names show on the chip; past it, a count. */
const NAMES_SHOWN = 2;

/** v2 filter chip. See {@link FilterChipProps}. */
export function FilterChip({ label, options, value, onChange, placeholder }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const picked = options.filter((o) => value.includes(o.value));
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const summary = picked.length > NAMES_SHOWN ? `${picked.length} selected` : picked.map((o) => o.label).join(', ');
  // Keep the catalogue's order, whatever order they were ticked in.
  const toggle = (v: string) =>
    onChange(options.map((o) => o.value).filter((x) => (x === v ? !value.includes(v) : value.includes(x))));
  return (
    <div className="inline-flex items-center">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          {picked.length ? (
            <button
              type="button"
              aria-label={`${label}: ${picked.map((o) => o.label).join(', ')}. Change`}
              className={`${CHIP} max-w-72 rounded-r-none bg-zebra-950/5 pr-2 text-zebra-950 hover:bg-zebra-950/10`}
            >
              <span className="text-zebra-500">{label}</span>
              <span className="truncate">{summary}</span>
            </button>
          ) : placeholder ? (
            <button type="button" className={`${CHIP} bg-zebra-950/5 text-zebra-950 hover:bg-zebra-950/10`}>
              <span className="text-zebra-500">{label}</span>
              {placeholder}
              <ChevronDown aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-zebra-500" />
            </button>
          ) : (
            <button type="button" className={`${CHIP} border border-dashed border-zebra-300 text-zebra-500 hover:border-zebra-400 hover:text-zebra-950`}>
              <Plus aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
              {label}
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent size="menu" align="start" aria-label={label} className="w-64">
          <div className="p-1 pb-1.5">
            <Input
              type="search"
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder={`Search ${label.toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leading={<Search strokeWidth={1.5} className="size-4" />}
              data-autofocus
            />
          </div>
          <div role="group" aria-label={label} className="max-h-72 overflow-y-auto">
            {shown.map((o) => (
              <Checkbox
                key={o.value}
                label={o.label}
                checked={value.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="flex h-8 w-full rounded-check px-2 hover:bg-zebra-100"
              />
            ))}
            {shown.length === 0 ? <p className="px-2 py-2 type-body text-zebra-400">No match</p> : null}
          </div>
          {picked.length ? (
            <div className="mt-1 border-t border-zebra-950/5 px-1 pt-1">
              <Button variant="plain" className="px-1" onClick={() => onChange([])}>
                Clear
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {picked.length ? (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()} filter`}
          onClick={() => onChange([])}
          className={`${CHIP} rounded-l-none border-l border-field bg-zebra-950/5 px-2 text-zebra-500 hover:bg-zebra-950/10 hover:text-zebra-950`}
        >
          <X aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
