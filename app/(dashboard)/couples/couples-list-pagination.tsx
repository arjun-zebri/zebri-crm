/**
 * Pagination footer for the couples-list table.
 *
 * Two variants in one component: a compact prev/next strip on
 * mobile (≤ sm) and a full page-number + page-size picker on
 * desktop. Driven by a `@tanstack/react-table` instance passed in
 * from the parent.
 *
 * @module app/(dashboard)/couples/couples-list-pagination
 */
'use client';

import type { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Couple } from '@/types/couple';

export interface CouplesListPaginationProps {
  table: Table<Couple>;
}

/** Compute the 4-page sliding window around the current page. Shows
 *  contiguous numbers; the parent renders a "…" + final-page jump
 *  when the window doesn't reach the end. */
function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 4) return Array.from({ length: totalPages }, (_, i) => i);
  const windowSize = 4;
  let windowStart = Math.max(0, currentPage - 3);
  windowStart = Math.min(totalPages - windowSize, windowStart);
  return Array.from({ length: windowSize }, (_, i) => windowStart + i);
}

interface PopoverPosition {
  bottom: number;
  right: number;
  width: number;
}

export function CouplesListPagination({ table }: CouplesListPaginationProps) {
  const pageSizeRef = useRef<HTMLDivElement>(null);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pageSizeRef.current &&
        !pageSizeRef.current.contains(e.target as Node)
      ) {
        setPageSizeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Measure the trigger's position when the popover opens. Reading
  // refs in render trips the react-compiler rule; this commits the
  // positions to state instead.
  useEffect(() => {
    if (!pageSizeOpen) {
      setPopoverPos(null);
      return;
    }
    const rect = pageSizeRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopoverPos({
      bottom: window.innerHeight - rect.top + 8,
      right: window.innerWidth - rect.right,
      width: rect.width,
    });
  }, [pageSizeOpen]);

  return (
    <>
      {/* Mobile: prev/next only */}
      {table.getPageCount() > 1 && (
        <div className="sm:hidden border-t border-gray-200 bg-white py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
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

      {/* Desktop: full pagination + page-size picker */}
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
                    table.getPageCount(),
                  ).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => table.setPageIndex(pageNum)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer ${
                        table.getState().pagination.pageIndex === pageNum
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  ))}
                  {(() => {
                    const pages = getPageNumbers(
                      table.getState().pagination.pageIndex,
                      table.getPageCount(),
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
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
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
            {pageSizeOpen && popoverPos && (
              <div
                className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1"
                style={{
                  bottom: popoverPos.bottom,
                  right: popoverPos.right,
                  width: popoverPos.width,
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
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pageSize}/page
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
