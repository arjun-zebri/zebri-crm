'use client';

/**
 * State behind the Prospects table: filters, paging, the bulk selection
 * and the page's query. The page, the stats strip and the table all read
 * the same filter state, so the strip's counts can narrow the table.
 *
 * @module features/outreach/views/prospects/use-prospects-list
 */
import { useCallback, useState } from 'react';

import { useProspects } from '@/features/outreach/hooks';

import { ALL, DEFAULT_FILTERS, type ProspectFilterState } from './prospects-filters';

/** Rows per page. */
export const PAGE_SIZE = 50;

/** Empty rule for "all" values: the query takes `undefined` for no filter. */
function narrow(v: string): string | undefined {
  return v === ALL ? undefined : v;
}

/**
 * Filter, page and selection state for the table, plus its query.
 *
 * Any filter change starts again at page one with nothing selected: a bulk
 * action should never act on rows the founder can no longer see.
 */
export function useProspectsList() {
  const [filters, setFilters] = useState<ProspectFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Bumping this remounts the filter bar, so its debounced search box
  // shows the cleared value after "Clear filters".
  const [filterKey, setFilterKey] = useState(0);

  const query = useProspects({
    search: filters.search || undefined,
    verdict: narrow(filters.verdict),
    stage: narrow(filters.stage),
    state: narrow(filters.state),
    hasEmail: filters.hasEmail || undefined,
    hasInstagram: filters.hasInstagram || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const changeFilters = useCallback((patch: Partial<ProspectFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
    setSelected(new Set());
    setFilterKey((k) => k + 1);
  }, []);

  const changePage = useCallback((next: number) => {
    setPage(next);
    setSelected(new Set());
  }, []);

  return {
    filters,
    filterKey,
    filtersActive: JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS),
    page,
    selected,
    query,
    changeFilters,
    changePage,
    clearFilters,
    clearSelection,
    toggle,
    toggleAll,
  };
}

/** The return value of {@link useProspectsList}. */
export type ProspectsList = ReturnType<typeof useProspectsList>;
