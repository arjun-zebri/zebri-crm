/**
 * /proposals header: title + count, search, New button.
 *
 * @module app/(dashboard)/proposals/proposals-header
 */
'use client';

import { Plus, Search, X } from 'lucide-react';
import type { RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

import { ProposalsNav } from './proposals-nav';

export interface ProposalsHeaderProps {
  count: number;
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onNew: () => void;
}

/** See {@link ProposalsHeaderProps}. */
export function ProposalsHeader({ count, search, onSearchChange, searchInputRef, onNew }: ProposalsHeaderProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Proposals"
        count={count}
        actions={
          // `aria-label` keeps this button's accessible name stable across
          // breakpoints: the visible label collapses to icon-only below
          // `sm` (`hidden sm:inline`), which would otherwise drop "New
          // proposal" from the accessible name on mobile and break any
          // getByRole lookup there.
          <Button onClick={onNew} className="gap-1.5" aria-label="New proposal">
            <Plus size={16} strokeWidth={1.5} />
            <span className="hidden sm:inline" aria-hidden="true">New proposal</span>
          </Button>
        }
      />
      {/* One "Proposals" heading for every tab; the tab strip sits under it. */}
      <ProposalsNav active="proposals" />
      {/* The /design-system Toolbar pattern: `Input` has no prefix slot
          (its `className` lands on the wrapper, not the field), so the
          search box mirrors Input's own classes with room for the icon. */}
      <div className="relative w-full sm:w-56">
        <Search
          size={11}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-subtle"
        />
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search proposals..."
          aria-label="Search proposals"
          className="block h-8 w-full rounded-control border border-border bg-surface pl-6 pr-6 text-body text-text transition-colors placeholder:text-text-subtle focus-visible:border-brand-fg focus-visible:outline-none"
        />
        {search ? (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              searchInputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-subtle transition-colors hover:text-text"
          >
            <X size={11} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
