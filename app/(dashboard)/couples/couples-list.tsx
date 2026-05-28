/**
 * Couples list — desktop table + mobile card list orchestrator.
 *
 * Composes:
 * - `<CouplesListMobile>` — viewport ≤ sm.
 * - Desktop table (this file) — uses `@tanstack/react-table` for
 *   pagination state; column definitions come from
 *   `createCouplesListColumns()` so the surface stays declarative.
 * - `<CouplesListPagination>` — footer with prev/next + page-size.
 * - `<CouplesListEmpty>` — `couples.length === 0 && !loading`.
 * - `useCouplesListDragSelect()` — marquee drag-select state.
 *
 * Row click semantics:
 * - Shift-click extends a contiguous selection from the
 *   last-clicked row.
 * - Click with an existing multi-select toggles the row in/out of
 *   the selection.
 * - Click with no selection opens the couple's profile.
 *
 * @module app/(dashboard)/couples/couples-list
 */
'use client';

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Couple, CoupleStatusRecord } from '@/types/couple';

import { createCouplesListColumns, COL_WIDTHS } from './couples-list-columns';
import { CouplesListEmpty } from './couples-list-empty';
import { CheckMark, DashMark } from './couples-list-icons';
import { CouplesListMobile } from './couples-list-mobile';
import { CouplesListPagination } from './couples-list-pagination';
import { useCouplesListDragSelect } from './use-couples-list-drag-select';

interface CouplesListProps {
  couples: Couple[];
  statuses: CoupleStatusRecord[];
  onRowClick: (couple: Couple) => void;
  loading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

const skeletonWidths = ['w-32', 'w-40', 'w-24', 'w-20', 'w-28', 'w-16'];

export function CouplesList({
  couples,
  statuses,
  onRowClick,
  loading,
  selectedIds,
  onSelectionChange,
}: CouplesListProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const lastClickedIdxRef = useRef(-1);
  const columns = useMemo(() => createCouplesListColumns(statuses), [statuses]);

  const { containerRef, dragRect, onContainerMouseDown, justDraggedRef } =
    useCouplesListDragSelect({ selectedIds, onSelectionChange });

  // Reset to page 1 when the underlying couples list changes (a new
  // filter or sort fires the same effect since the input array is
  // a new reference).
  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 25 });
  }, [couples]);

  const table = useReactTable({
    data: couples,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (couples.length === 0 && !loading) {
    return <CouplesListEmpty />;
  }

  const rows = table.getRowModel().rows;
  const currentPageIds = rows.map((r) => r.original.id);
  const allPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedIds.has(id));
  const somePageSelected = currentPageIds.some((id) => selectedIds.has(id));

  const handleSelectAll = () => {
    const newSelected = new Set(selectedIds);
    if (allPageSelected) {
      currentPageIds.forEach((id) => newSelected.delete(id));
    } else {
      currentPageIds.forEach((id) => newSelected.add(id));
    }
    onSelectionChange(newSelected);
  };

  const handleToggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  const handleRowClick = (
    couple: Couple,
    idx: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (justDraggedRef.current) return;

    if (e.shiftKey) {
      e.preventDefault();
      const start =
        lastClickedIdxRef.current >= 0
          ? Math.min(lastClickedIdxRef.current, idx)
          : idx;
      const end =
        lastClickedIdxRef.current >= 0
          ? Math.max(lastClickedIdxRef.current, idx)
          : idx;
      const newSelected = new Set(selectedIds);
      for (let i = start; i <= end; i++) {
        newSelected.add(rows[i].original.id);
      }
      onSelectionChange(newSelected);
      lastClickedIdxRef.current = idx;
      return;
    }

    if (selectedIds.size > 0) {
      handleToggleRow(couple.id, e);
      lastClickedIdxRef.current = idx;
    } else {
      onRowClick(couple);
      lastClickedIdxRef.current = idx;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto"
        ref={containerRef}
        onMouseDown={onContainerMouseDown}
      >
        <CouplesListMobile
          rows={rows}
          statuses={statuses}
          loading={loading}
          onRowClick={onRowClick}
        />

        <table className="hidden sm:table w-full table-fixed border-separate border-spacing-0 min-w-[400px] md:max-w-[1800px] select-none">
          <thead className="sticky top-0 bg-white z-10 [box-shadow:0_1px_0_rgb(229,231,235)]">
            <tr className="group/header">
              {table.getHeaderGroups()[0]?.headers.map((header, idx) => {
                const meta = header.column.columnDef.meta as
                  | { hidden?: string }
                  | undefined;
                return (
                  <th
                    key={header.id}
                    data-couple-checkbox={idx === 0 ? true : undefined}
                    className={`pl-0 pr-2 py-1.5 text-left text-xs font-normal text-gray-400 ${
                      idx === 0 ? 'relative' : ''
                    } ${meta?.hidden || ''}`}
                    style={{ width: COL_WIDTHS[header.id] }}
                  >
                    {idx === 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAll();
                        }}
                        className={`absolute top-1/2 -left-9 -translate-y-1/2 shrink-0 w-4 h-4 rounded border transition cursor-pointer flex items-center justify-center ${
                          allPageSelected || somePageSelected
                            ? 'bg-emerald-500 border-emerald-500 opacity-100'
                            : 'border-gray-300 hover:border-gray-500 opacity-0 group-hover/header:opacity-100'
                        }`}
                        aria-label={
                          allPageSelected ? 'Deselect all' : 'Select all'
                        }
                      >
                        {allPageSelected ? (
                          <CheckMark />
                        ) : somePageSelected ? (
                          <DashMark />
                        ) : null}
                      </button>
                    )}
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((_, j) => (
                      <td
                        key={j}
                        className="pl-0 pr-2 py-2 border-b border-gray-100"
                      >
                        <div
                          className={`h-4 bg-gray-100 rounded-md ${skeletonWidths[j]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, idx) => {
                  const isSelected = selectedIds.has(row.original.id);
                  const isLastRow = idx === rows.length - 1;
                  const borderClass = isLastRow
                    ? ''
                    : 'border-b border-gray-100';
                  return (
                    <tr
                      key={row.id}
                      data-couple-id={row.original.id}
                      onClick={(e) => handleRowClick(row.original, idx, e)}
                      className={`cursor-pointer transition group ${
                        isSelected ? 'bg-emerald-50/40' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      {row.getVisibleCells().map((cell, cellIdx, allCells) => {
                        const isLastCell = cellIdx === allCells.length - 1;
                        const isFirstCell = cellIdx === 0;
                        const meta = cell.column.columnDef.meta as
                          | { hidden?: string }
                          | undefined;
                        return (
                          <td
                            key={cell.id}
                            className={`pl-0 pr-2 py-2 text-sm ${borderClass} ${
                              isFirstCell ? 'relative' : 'overflow-hidden'
                            } ${meta?.hidden || ''} ${isLastCell ? 'pr-3' : ''}`}
                          >
                            {isFirstCell && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleRow(row.original.id, e);
                                }}
                                className={`absolute top-1/2 -left-9 -translate-y-1/2 shrink-0 w-4 h-4 rounded border transition cursor-pointer flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-emerald-500 border-emerald-500 opacity-100'
                                    : `border-gray-300 hover:border-gray-500 ${
                                        selectedIds.size > 0
                                          ? 'opacity-100'
                                          : 'opacity-0 group-hover:opacity-100'
                                      }`
                                }`}
                                aria-label={
                                  isSelected
                                    ? 'Deselect couple'
                                    : 'Select couple'
                                }
                              >
                                {isSelected && <CheckMark />}
                              </button>
                            )}
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <CouplesListPagination table={table} />

      {dragRect &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: dragRect.x,
              top: dragRect.y,
              width: dragRect.w,
              height: dragRect.h,
              background: 'rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: 3,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          />,
          document.body,
        )}
    </div>
  );
}
