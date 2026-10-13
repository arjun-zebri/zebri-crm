'use client';

/**
 * The Prospects table section: filters, the bulk bar, and the table (or
 * card list on a phone) with its paging. Filter, page and selection state
 * come from {@link useProspectsList}; this only lays them out and renders
 * the loading, error and no-match states.
 *
 * @module features/outreach/views/prospects/prospects-list
 */
import { Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

import { ProspectsBulkBar } from './prospects-bulk-bar';
import { ProspectsCards } from './prospects-cards';
import { ProspectsFilters } from './prospects-filters';
import { ProspectsPagination } from './prospects-pagination';
import { ProspectsTable } from './prospects-table';
import { PAGE_SIZE } from './use-prospects-list';
import type { ProspectsList as ProspectsListState } from './use-prospects-list';

/** Props for {@link ProspectsList}. */
export interface ProspectsListProps {
  list: ProspectsListState;
  /** Opens the prospect modal for a row. */
  onOpen: (id: string) => void;
}

/** Filters, bulk actions and the paged list for the Table layout. */
export function ProspectsList({ list, onOpen }: ProspectsListProps) {
  const { filters, filterKey, filtersActive, page, selected, query, changeFilters, changePage, clearFilters, clearSelection, toggle, toggleAll } = list;  const filterBar = <ProspectsFilters key={filterKey} value={filters} onChange={changeFilters} />;

  if (query.isPending) {
    return (
      <div className="space-y-6">
        {filterBar}
        <SkeletonRegion label="Loading prospects">
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </SkeletonRegion>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {filterBar}
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const { rows, total } = query.data;

  return (
    <div className="space-y-6">
      {filterBar}

      {selected.size > 0 && <ProspectsBulkBar selectedIds={[...selected]} onDone={clearSelection} />}

      {rows.length === 0 ? (
        // With no filter on, an empty page means paging ran past the end
        // (the last row was removed); the way out is back to page one.
        filtersActive ? (
          <Empty
            icon={Users}
            title="No prospects match these filters"
            description="Try a different search or clear the filters."
            action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <Empty
            icon={Users}
            title="No prospects on this page"
            action={<Button variant="outline" onClick={() => changePage(0)}>Back to first page</Button>}
          />
        )
      ) : (
        // Dim the list while a page or filter change loads. placeholderData keeps
        // the old rows on screen, so without this the founder cannot tell stale
        // rows from fresh ones. aria-busy tells assistive tech the same thing.
        <div
          aria-busy={query.isFetching || undefined}
          className={`space-y-6 transition-opacity ${query.isFetching ? 'opacity-60' : 'opacity-100'}`}
        >
          <ProspectsTable rows={rows} selected={selected} onToggle={toggle} onToggleAll={toggleAll} onOpen={onOpen} />
          <ProspectsCards rows={rows} selected={selected} onToggle={toggle} onOpen={onOpen} />
          <ProspectsPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={changePage} />
        </div>
      )}
    </div>
  );
}
