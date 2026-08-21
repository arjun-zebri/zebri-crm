'use client';

import { Search, X } from 'lucide-react';
import { useRef } from 'react';

/** Which slice of the booking list is on screen. */
export type BookingFilter = 'upcoming' | 'past' | 'cancelled';

/** Tab order, with the label each one shows. */
const FILTERS: { value: BookingFilter; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
];

export interface BookingsToolbarProps {
  filter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
  /** Row count per filter, shown beside each label. */
  counts: Record<BookingFilter, number>;
  search: string;
  onSearchChange: (search: string) => void;
}

/**
 * Filter switcher and search field above the booking list.
 *
 * The counts live in the switcher rather than in a heading because "Past 12"
 * is the answer to the only question the label raises, and it saves a row of
 * chrome above a list that is already grouped by day.
 *
 * @module app/(dashboard)/calendar/bookings-toolbar
 */
export function BookingsToolbar({
  filter,
  onFilterChange,
  counts,
  search,
  onSearchChange,
}: BookingsToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        role="tablist"
        aria-label="Booking filter"
        className="inline-flex gap-0.5 self-start rounded-control bg-surface-muted p-0.5"
      >
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(value)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-control px-3 text-body font-medium transition-colors ${
                active
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {label}
              <span className="text-text-subtle">{counts[value]}</span>
            </button>
          );
        })}
      </div>

      {/* Same geometry as the couples toolbar search: not the Input
          primitive, which has no slot for a leading icon or a clear button. */}
      <div className="relative w-full sm:w-64">
        <Search
          size={12}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search name or couple"
          aria-label="Search bookings"
          className="block h-8 w-full rounded-control border border-border bg-surface pl-7 pr-7 text-body text-text transition-colors placeholder:text-text-subtle focus-visible:border-brand-fg focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-subtle transition-colors hover:text-text"
          >
            <X size={11} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
