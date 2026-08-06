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
        <div className="sm:hidden border-t border-gray-200 bg-white py-3 flex items-center justify-between px-4">
          <span className="text-sm text-gray-500">
            Page {safePageIndex + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => canPrev && onPageChange(safePageIndex - 1)}
              disabled={!canPrev}
              className="p-2 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-control transition text-gray-600"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => canNext && onPageChange(safePageIndex + 1)}
              disabled={!canNext}
              className="p-2 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-control transition text-gray-600"
              aria-label="Next page"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop: full pagination + page-size picker */}
      <div className="hidden sm:flex border-t border-gray-200 bg-white px-6 py-3.5 justify-end relative">
        <div className="flex items-center gap-3">
          {pageCount > 1 && (
            <>
              <div className="flex items-center w-[280px]">
                <button
                  onClick={() => canPrev && onPageChange(safePageIndex - 1)}
                  disabled={!canPrev}
                  className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded-control text-gray-600 shrink-0"
                  title="Previous page"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>

                <div className="flex flex-1 items-center justify-center gap-1">
                  {pages.map((p) => (
                    <button
                      key={p}
                      onClick={() => onPageChange(p)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-control transition cursor-pointer ${
                        safePageIndex === p
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p + 1}
                    </button>
                  ))}
                  {showEllipsis && <span className="px-1 text-xs text-gray-400">…</span>}
                  {showLastJump && (
                    <button
                      onClick={() => onPageChange(lastPage)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-control transition cursor-pointer ${
                        safePageIndex === lastPage
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {lastPage + 1}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => canNext && onPageChange(safePageIndex + 1)}
                  disabled={!canNext}
                  className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded-control text-gray-600 shrink-0"
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
              className="border border-gray-200 rounded-control px-3 py-2 text-sm bg-white text-gray-600 hover:border-gray-300 cursor-pointer transition"
            >
              {pageSize}/page
            </button>
            {pageSizeOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-control shadow-lg z-50 py-1 min-w-[88px]">
                {PAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      onPageSizeChange(size)
                      setPageSizeOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      pageSize === size
                        ? 'bg-gray-50 text-gray-900 font-medium'
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
