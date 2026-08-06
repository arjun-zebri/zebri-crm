/**
 * Pagination footer - visually matches the couples-list pagination.
 *
 * Right-aligned: prev arrow · page numbers · next arrow · thin
 * divider · page-size picker. Mobile collapses to a prev/next strip
 * (same as couples). Page navigation is wired to local state;
 * page-size picker uses the same popover pattern as couples.
 *
 * @module app/(dashboard)/automations/pagination-bar
 */
'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  total: number
  pageSize: number
  pageIndex: number
  onPageChange: (next: number) => void
  onPageSizeChange: (next: number) => void
}

const PAGE_SIZES = [10, 25, 50]

export function PaginationBar({
  total,
  pageSize,
  pageIndex,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const canPrev = safePageIndex > 0
  const canNext = safePageIndex < pageCount - 1

  const pageSizeRef = useRef<HTMLDivElement>(null)
  const [pageSizeOpen, setPageSizeOpen] = useState(false)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target as Node)) {
        setPageSizeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (total === 0) return null

  const pages = getPageNumbers(safePageIndex, pageCount)
  const lastInWindow = pages[pages.length - 1] ?? -1
  const lastPage = pageCount - 1
  const showLastJump = lastInWindow < lastPage
  const showEllipsis = showLastJump && lastInWindow < lastPage - 1

  return (
    <>
      {/* Mobile: prev/next only */}
      {pageCount > 1 && (
        <div className="sm:hidden border-t border-border bg-surface py-3 flex items-center justify-between px-4">
          <span className="text-body text-text-muted">
            Page {safePageIndex + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => canPrev && onPageChange(safePageIndex - 1)}
              disabled={!canPrev}
              className="p-2 hover:bg-surface-emphasis disabled:opacity-30 disabled:cursor-not-allowed rounded-control transition text-gray-600"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => canNext && onPageChange(safePageIndex + 1)}
              disabled={!canNext}
              className="p-2 hover:bg-surface-emphasis disabled:opacity-30 disabled:cursor-not-allowed rounded-control transition text-gray-600"
              aria-label="Next page"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop: full pagination + page-size picker */}
      <div className="hidden sm:flex border-t border-border bg-surface px-6 py-3.5 justify-end relative">
        <div className="flex items-center gap-3">
          {pageCount > 1 && (
            <>
              <div className="flex items-center w-[280px]">
                <button
                  onClick={() => canPrev && onPageChange(safePageIndex - 1)}
                  disabled={!canPrev}
                  className="p-1.5 hover:bg-surface-emphasis disabled:opacity-30 disabled:cursor-not-allowed transition rounded-control text-gray-600 shrink-0"
                  title="Previous page"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>

                <div className="flex flex-1 items-center justify-center gap-1">
                  {pages.map((p) => (
                    <button
                      key={p}
                      onClick={() => onPageChange(p)}
                      className={`px-2.5 py-1 text-caption font-medium rounded-control transition cursor-pointer ${
                        safePageIndex === p
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-surface-emphasis'
                      }`}
                    >
                      {p + 1}
                    </button>
                  ))}
                  {showEllipsis && <span className="px-1 text-caption text-text-subtle">…</span>}
                  {showLastJump && (
                    <button
                      onClick={() => onPageChange(lastPage)}
                      className={`px-2.5 py-1 text-caption font-medium rounded-control transition cursor-pointer ${
                        safePageIndex === lastPage
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-surface-emphasis'
                      }`}
                    >
                      {lastPage + 1}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => canNext && onPageChange(safePageIndex + 1)}
                  disabled={!canNext}
                  className="p-1.5 hover:bg-surface-emphasis disabled:opacity-30 disabled:cursor-not-allowed transition rounded-control text-gray-600 shrink-0"
                  title="Next page"
                >
                  <ChevronRight size={16} strokeWidth={1.5} />
                </button>
              </div>

              <div className="h-5 w-px bg-gray-200" />
            </>
          )}

          <div ref={pageSizeRef} className="relative">
            <button
              onClick={() => setPageSizeOpen(!pageSizeOpen)}
              className="border border-border rounded-control px-3 py-2 text-body bg-surface text-gray-600 hover:border-border-strong cursor-pointer transition"
            >
              {pageSize}/page
            </button>
            {pageSizeOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-surface border border-border rounded-control shadow-lg z-50 py-1 min-w-[88px]">
                {PAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      onPageSizeChange(size)
                      setPageSizeOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-body transition cursor-pointer ${
                      pageSize === size
                        ? 'bg-gray-50 text-text font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {size}/page
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 4) return Array.from({ length: totalPages }, (_, i) => i)
  const windowSize = 4
  let windowStart = Math.max(0, currentPage - 3)
  windowStart = Math.min(totalPages - windowSize, windowStart)
  return Array.from({ length: windowSize }, (_, i) => windowStart + i)
}
