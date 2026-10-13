'use client';

/**
 * Desktop table of prospects. Clicking a row opens the prospect, and so does
 * the name link, which is the keyboard route in. The checkbox column selects
 * for bulk actions without opening anything. Hidden below `md`,
 * where {@link ProspectsCards} takes over.
 *
 * @module features/outreach/views/prospects/prospects-table
 */
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import type { ProspectRow } from '@/lib/outreach/services/queries';

import { prospectColumns } from './prospects-columns';

/** Props for {@link ProspectsTable}. */
export interface ProspectsTableProps {
  rows: ProspectRow[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onOpen: (id: string) => void;
}

/** The desktop table. */
export function ProspectsTable({ rows, selected, onToggle, onToggleAll, onOpen }: ProspectsTableProps) {
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const columns = useMemo(
    () => prospectColumns({ selected, onToggle, onToggleAll, onOpen, pageIds }),
    [selected, onToggle, onToggleAll, onOpen, pageIds],
  );
  // TanStack Table hands back fresh functions each render, so the React
  // Compiler skips memoising this component. That's expected; rows are one page.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getRowId: (r) => r.id });

  return (
    <div className="hidden md:block bg-surface border border-border rounded-control overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <thead className="bg-surface-muted border-b border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 text-left font-medium text-text-muted whitespace-nowrap">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onOpen(row.original.id)}
                className={`border-b border-border last:border-b-0 hover:bg-surface-muted cursor-pointer ${row.original.do_not_contact ? 'text-text-subtle' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
