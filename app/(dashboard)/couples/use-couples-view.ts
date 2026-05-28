/**
 * Filter + sort state for the `/couples` list/kanban surface.
 *
 * Owns the search box value, status filter chip, sort field, and
 * sort direction. Returns the derived `filteredCouples` (list
 * surface — sorted by user choice) and `kanbanCouples` (kanban
 * surface — sorted by `kanban_position` regardless of user choice).
 *
 * Pure derivation from the input couples array; no side effects.
 * Extracted from `page.tsx` so the orchestrator is a thin
 * composition, and the view-state can be unit-tested without
 * mounting the page.
 *
 * @module app/(dashboard)/couples/use-couples-view
 */
'use client';

import { useMemo, useState } from 'react';

import type { Couple, SortDirection, SortField } from '@/types/couple';

export interface UseCouplesViewResult {
  search: string;
  setSearch: (next: string) => void;
  statusFilter: string | 'all';
  setStatusFilter: (next: string | 'all') => void;
  sortField: SortField;
  sortDirection: SortDirection;
  setSort: (field: SortField, direction: SortDirection) => void;
  /** Search + status applied; user-sorted (list surface). */
  filteredCouples: Couple[];
  /** Search + status applied; `kanban_position`-sorted (kanban surface). */
  kanbanCouples: Couple[];
}

export function useCouplesView(couples: Couple[]): UseCouplesViewResult {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const baseFiltered = useMemo(() => {
    const term = search.toLowerCase();
    return couples.filter((couple) => {
      const matchesSearch =
        term === '' ||
        couple.name.toLowerCase().includes(term) ||
        couple.email.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === 'all' || couple.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [couples, search, statusFilter]);

  const filteredCouples = useMemo(() => {
    return [...baseFiltered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }, [baseFiltered, sortField, sortDirection]);

  const kanbanCouples = useMemo(() => {
    return [...baseFiltered].sort(
      (a, b) => (a.kanban_position ?? 0) - (b.kanban_position ?? 0),
    );
  }, [baseFiltered]);

  const setSort = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortField,
    sortDirection,
    setSort,
    filteredCouples,
    kanbanCouples,
  };
}
