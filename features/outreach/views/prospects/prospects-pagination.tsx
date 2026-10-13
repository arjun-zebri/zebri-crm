'use client';

/**
 * Previous / next paging under the Prospects list, with the visible range.
 *
 * @module features/outreach/views/prospects/prospects-pagination
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Props for {@link ProspectsPagination}. */
export interface ProspectsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

/** "1 to 50 of 320" with previous and next. Renders nothing for a single page. */
export function ProspectsPagination({ page, pageSize, total, onPage }: ProspectsPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="text-body text-text-subtle">{total} {total === 1 ? 'prospect' : 'prospects'}</p>;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-body text-text-subtle">{from} to {to} of {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={14} strokeWidth={1.5} aria-hidden="true" />
          Previous
        </Button>
        <Button variant="outline" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          Next
          <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
