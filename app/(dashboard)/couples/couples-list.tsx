"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Couple, CoupleStatusRecord, getStatusClasses } from "./couples-types";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface CouplesListProps {
  couples: Couple[];
  statuses: CoupleStatusRecord[];
  onRowClick: (couple: Couple) => void;
  loading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

const columnHelper = createColumnHelper<Couple>();

// Column width percentages (total = 100%)
const COL_WIDTHS: Record<string, string> = {
  select: "4%",
  name: "21%",
  email: "23%",
  phone: "13%",
  event_date: "12%",
  venue: "17%",
  status: "10%",
};

function createColumns(statuses: CoupleStatusRecord[]) {
  return [
    columnHelper.accessor("name", {
      header: "Name",
      enableSorting: false,
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("email", {
      header: "Email",
      enableSorting: false,
      meta: { hidden: "hidden sm:table-cell" },
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("phone", {
      header: "Phone",
      enableSorting: false,
      meta: { hidden: "hidden lg:table-cell" },
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("event_date", {
      header: "Event date",
      enableSorting: false,
      meta: { hidden: "hidden sm:table-cell" },
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900">
          {formatDate(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("venue", {
      header: "Venue",
      enableSorting: false,
      meta: { hidden: "hidden lg:table-cell" },
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      enableSorting: false,
      cell: (info) => {
        const statusSlug = info.getValue();
        const status = statuses.find((s) => s.slug === statusSlug);
        const classes = status
          ? getStatusClasses(status.color)
          : getStatusClasses("gray");
        const statusName =
          status?.name ||
          statusSlug.charAt(0).toUpperCase() + statusSlug.slice(1);
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${classes.pill}`}
          >
            {statusName}
          </span>
        );
      },
    }),
  ];
}

const skeletonWidths = ["w-32", "w-40", "w-24", "w-20", "w-28", "w-16"];

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 4) return Array.from({ length: totalPages }, (_, i) => i);

  const windowSize = 4;
  let windowStart = Math.max(0, currentPage - 3);
  windowStart = Math.min(totalPages - windowSize, windowStart);

  return Array.from({ length: windowSize }, (_, i) => windowStart + i);
}

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
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const justDraggedRef = useRef(false);
  const lastClickedIdxRef = useRef(-1);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const columns = createColumns(statuses);

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 25 });
  }, [couples]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pageSizeRef.current &&
        !pageSizeRef.current.contains(e.target as Node)
      ) {
        setPageSizeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        isDraggingRef.current = true;
        document.body.style.userSelect = 'none';
        const newRect = {
          x: Math.min(e.clientX, dragStartRef.current.x),
          y: Math.min(e.clientY, dragStartRef.current.y),
          w: Math.abs(dx),
          h: Math.abs(dy),
        };
        dragRectRef.current = newRect;
        setDragRect(newRect);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current && dragRectRef.current) {
        const r = dragRectRef.current;
        const rows = containerRef.current?.querySelectorAll<HTMLElement>('tr[data-couple-id]');
        if (rows) {
          const newSelected = new Set(selectedIds);
          rows.forEach((row) => {
            const rowRect = row.getBoundingClientRect();
            if (
              rowRect.left < r.x + r.w &&
              rowRect.right > r.x &&
              rowRect.top < r.y + r.h &&
              rowRect.bottom > r.y
            ) {
              const coupleId = row.getAttribute('data-couple-id');
              if (coupleId) newSelected.add(coupleId);
            }
          });
          onSelectionChange(newSelected);
        }
        justDraggedRef.current = true;
        setTimeout(() => (justDraggedRef.current = false), 100);

        // Swallow the click that fires after the drag — otherwise the page
        // wrapper's background click handler clears the selection we just made.
        const suppressNextClick = (e: MouseEvent) => {
          e.stopImmediatePropagation();
          window.removeEventListener('click', suppressNextClick, true);
        };
        window.addEventListener('click', suppressNextClick, true);
        setTimeout(() => window.removeEventListener('click', suppressNextClick, true), 250);
      }
      dragStartRef.current = null;
      isDraggingRef.current = false;
      dragRectRef.current = null;
      document.body.style.userSelect = '';
      setDragRect(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedIds, onSelectionChange]);

  const table = useReactTable({
    data: couples,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (couples.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users size={40} strokeWidth={1.5} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium mb-2">No couples yet.</p>
        <p className="text-sm text-gray-500 mb-4">
          Start by adding your first couple.
        </p>
      </div>
    );
  }

  const currentPageIds = table.getRowModel().rows.map(r => r.original.id);
  const allPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));
  const somePageSelected = currentPageIds.some(id => selectedIds.has(id));

  const handleSelectAll = () => {
    if (allPageSelected) {
      const newSelected = new Set(selectedIds);
      currentPageIds.forEach(id => newSelected.delete(id));
      onSelectionChange(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      currentPageIds.forEach(id => newSelected.add(id));
      onSelectionChange(newSelected);
    }
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

  const handleRowClick = (couple: Couple, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (justDraggedRef.current) return;

    if (e.shiftKey) {
      e.preventDefault();
      const start = lastClickedIdxRef.current >= 0 ? Math.min(lastClickedIdxRef.current, idx) : idx;
      const end = lastClickedIdxRef.current >= 0 ? Math.max(lastClickedIdxRef.current, idx) : idx;
      const rows = table.getRowModel().rows;
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
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto" ref={containerRef} onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }}>
        {/* ── Mobile card list ── */}
        <div className="sm:hidden pb-24">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1 pr-3">
                    <div className="h-4 bg-gray-100 rounded-md w-36 mb-1.5" />
                    <div className="h-3 bg-gray-100 rounded-md w-24" />
                  </div>
                  <div className="h-5 bg-gray-100 rounded-full w-16" />
                </div>
              ))
            : table.getRowModel().rows.map((row) => {
                const couple = row.original;
                const status = statuses.find((s) => s.slug === couple.status);
                const classes = status
                  ? getStatusClasses(status.color)
                  : getStatusClasses("gray");
                const statusName =
                  status?.name ||
                  couple.status.charAt(0).toUpperCase() +
                    couple.status.slice(1);
                const secondary = [
                  couple.event_date && formatDate(couple.event_date),
                  couple.venue,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={row.id}
                    onClick={() => onRowClick(couple)}
                    className="flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-50 transition"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {couple.name}
                      </p>
                      {secondary && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {secondary}
                        </p>
                      )}
                    </div>
                    <span
                      className={`flex-none mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${classes.pill}`}
                    >
                      {statusName}
                    </span>
                  </div>
                );
              })}
        </div>

        {/* ── Desktop table ── */}
        <table className="hidden sm:table w-full table-fixed border-separate border-spacing-0 min-w-[400px] md:max-w-[1800px] select-none">
          <thead className="sticky top-0 bg-white z-10 [box-shadow:0_1px_0_rgb(229,231,235)]">
            <tr>
              <th
                data-couple-checkbox
                className="py-3.5 pl-3 text-left text-sm font-medium text-gray-900"
                style={{ width: COL_WIDTHS.select }}
              >
                <input
                  type="checkbox"
                  ref={(el) => {
                    if (el) el.indeterminate = somePageSelected && !allPageSelected;
                  }}
                  checked={allPageSelected}
                  onChange={handleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-black cursor-pointer"
                />
              </th>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-0 py-3.5 text-left text-sm font-medium text-gray-900 ${
                    (header.column.columnDef.meta as any)?.hidden || ""
                  }`}
                  style={{ width: COL_WIDTHS[header.id] }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((_, j) => (
                      <td key={j} className="px-0 py-3.5 border-b border-gray-100">
                        <div
                          className={`h-4 bg-gray-100 rounded-md ${skeletonWidths[j]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row, idx) => {
                  const isSelected = selectedIds.has(row.original.id);
                  const isLastRow = idx === table.getRowModel().rows.length - 1;
                  const borderClass = isLastRow ? '' : 'border-b border-gray-100';
                  return (
                    <tr
                      key={row.id}
                      data-couple-id={row.original.id}
                      onClick={(e) => handleRowClick(row.original, idx, e)}
                      className={`cursor-pointer transition group ${isSelected ? 'bg-gray-50' : ''}`}
                    >
                      <td
                        className={`py-3.5 pl-3 text-sm ${borderClass}`}
                        style={{ width: COL_WIDTHS.select }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleRow(row.original.id, e as any)}
                          className="accent-black cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      {row.getVisibleCells().map((cell, cellIdx, allCells) => {
                        const isLastCell = cellIdx === allCells.length - 1;
                        return (
                          <td
                            key={cell.id}
                            className={`px-0 py-3.5 text-sm overflow-hidden ${borderClass} ${
                              (cell.column.columnDef.meta as any)?.hidden || ""
                            } ${isLastCell ? 'pr-3' : ''}`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile pagination — simple prev/next ── */}
      {table.getPageCount() > 1 && (
        <div className="sm:hidden border-t border-gray-200 bg-white py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition text-gray-600"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition text-gray-600"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop pagination ── */}
      <div className="hidden sm:flex border-t border-gray-200 bg-white px-6 py-3.5 justify-end relative">
        <div className="flex items-center gap-3">
          {table.getPageCount() > 1 && (
            <>
              <div className="flex items-center w-[280px]">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded text-gray-600 shrink-0"
                  title="Previous page"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>

                <div className="flex flex-1 items-center justify-center gap-1">
                  {getPageNumbers(
                    table.getState().pagination.pageIndex,
                    table.getPageCount()
                  ).map((pageNum, idx) => (
                    <button
                      key={idx}
                      onClick={() => table.setPageIndex(pageNum)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer ${
                        table.getState().pagination.pageIndex === pageNum
                          ? "bg-gray-900 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  ))}
                  {(() => {
                    const pages = getPageNumbers(
                      table.getState().pagination.pageIndex,
                      table.getPageCount()
                    );
                    const lastPage = table.getPageCount() - 1;
                    if (pages[pages.length - 1] >= lastPage) return null;
                    const adjacent = pages[pages.length - 1] === lastPage - 1;
                    return (
                      <>
                        {!adjacent && (
                          <span className="px-1 text-xs text-gray-400">…</span>
                        )}
                        <button
                          onClick={() => table.setPageIndex(lastPage)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer ${
                            table.getState().pagination.pageIndex === lastPage
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {lastPage + 1}
                        </button>
                      </>
                    );
                  })()}
                </div>

                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded text-gray-600 shrink-0"
                  title="Next page"
                >
                  <ChevronRight size={16} strokeWidth={1.5} />
                </button>
              </div>

              <div className="h-5 w-px bg-gray-200" />
            </>
          )}

          <div ref={pageSizeRef}>
            <button
              onClick={() => setPageSizeOpen(!pageSizeOpen)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-600 hover:border-gray-300 cursor-pointer transition"
            >
              {table.getState().pagination.pageSize}/page
            </button>
            {pageSizeOpen && (
              <div
                className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1"
                style={{
                  bottom:
                    window.innerHeight -
                    (pageSizeRef.current?.getBoundingClientRect().top || 0) +
                    8,
                  right:
                    window.innerWidth -
                    (pageSizeRef.current?.getBoundingClientRect().right || 0),
                  width: pageSizeRef.current?.getBoundingClientRect().width,
                }}
              >
                {[10, 25, 50].map((pageSize) => (
                  <button
                    key={pageSize}
                    onClick={() => {
                      table.setPageSize(pageSize);
                      setPageSizeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      table.getState().pagination.pageSize === pageSize
                        ? "bg-gray-50 text-gray-900 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {pageSize}/page
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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
            document.body
          )}
      </div>
    </div>
  );
}
