'use client';

/**
 * Filter bar for the Prospects table. Search is debounced so the table
 * does not refetch on every keystroke; every other control applies at
 * once. Any change resets to page one (the parent does that). Below `md`
 * only the search box shows; the rest sits behind a Filters toggle that
 * carries a count of the filters in use, so a phone is not a wall of
 * selects.
 *
 * @module features/outreach/views/prospects/prospects-filters
 */
import { Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { STAGES } from '@/lib/outreach/types';

import { STAGE_LABELS, STATES } from './labels';

/** The "show everything" value for a Select. Select cannot hold an empty string. */
export const ALL = 'all';

/** Filter state as the view holds it. `ALL` means no filter on that field. */
export interface ProspectFilterState {
  search: string;
  verdict: string;
  stage: string;
  state: string;
  hasEmail: boolean;
  hasInstagram: boolean;
}

/** Starting filters: nothing narrowed. */
export const DEFAULT_FILTERS: ProspectFilterState = {
  search: '',
  verdict: ALL,
  stage: ALL,
  state: ALL,
  hasEmail: false,
  hasInstagram: false,
};

const SEARCH_DEBOUNCE_MS = 300;

const STAGE_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'All stages' },
  ...STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] })),
];
const STATE_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'All states' },
  ...STATES.map((s) => ({ value: s, label: s })),
];

/** Props for {@link ProspectsFilters}. */
export interface ProspectsFiltersProps {
  value: ProspectFilterState;
  onChange: (patch: Partial<ProspectFilterState>) => void;
}

/** How many non-default filters are in use. Search is not counted: it is always visible. */
export function countActiveFilters(value: ProspectFilterState): number {
  return [value.verdict !== ALL, value.stage !== ALL, value.state !== ALL, value.hasEmail, value.hasInstagram].filter(Boolean).length;
}

/** Search, the stage and state selects and the two has-contact checkboxes. Status is filtered by the stats chips. */
export function ProspectsFilters({ value, onChange }: ProspectsFiltersProps) {
  const [text, setText] = useState(value.search);
  // Collapsed by default on phones only; desktop ignores this and always shows the row.
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const activeCount = countActiveFilters(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cancel a pending search when the list unmounts, so a late timer
  // cannot call back into a view that has gone.
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(next: string) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ search: next.trim() }), SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 md:max-w-md md:flex-none md:w-full">
          <Input
            aria-label="Search prospects"
            value={text}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name, email, suburb or handle"
            leadingIcon={<Search size={14} strokeWidth={1.5} />}
          />
        </div>
        <Button
          variant="outline"
          className="shrink-0 md:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-pill bg-brand-bg px-1.5 text-brand-fg">{activeCount}</span>
          )}
        </Button>
      </div>
      <div id={panelId} className={`${open ? 'flex' : 'hidden'} flex-wrap items-end gap-3 md:flex`}>
        <div className="w-full md:w-40">
          <Select options={STAGE_OPTIONS} value={value.stage} onValueChange={(stage) => onChange({ stage })} ariaLabel="Stage" />
        </div>
        <div className="w-full md:w-36">
          <Select options={STATE_OPTIONS} value={value.state} onValueChange={(state) => onChange({ state })} ariaLabel="State" />
        </div>
        <Checkbox checked={value.hasEmail} onChange={(hasEmail) => onChange({ hasEmail })} label="Has email" />
        <Checkbox checked={value.hasInstagram} onChange={(hasInstagram) => onChange({ hasInstagram })} label="Has Instagram" />
      </div>
    </div>
  );
}
