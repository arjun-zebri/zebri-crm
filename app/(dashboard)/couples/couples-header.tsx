'use client'

import { useEffect, useRef, useState } from 'react'
import { List, LayoutGrid, Plus, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
import {
  Couple,
  CoupleStatusRecord,
  ViewMode,
  SortField,
  SortDirection,
  SORT_OPTIONS,
} from './couples-types'

interface CouplesHeaderProps {
  couples: Couple[]
  statuses: CoupleStatusRecord[]
  onAddClick: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  search: string
  onSearchChange: (search: string) => void
  statusFilter: string | 'all'
  onStatusFilterChange: (status: string | 'all') => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
}

export function CouplesHeader({
  couples,
  statuses,
  onAddClick,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  sortDirection,
  onSortChange,
}: CouplesHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          searchInputRef.current?.focus()
        }
      }
      if (e.key === 'Escape') {
        onSearchChange('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSearchChange])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false)
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const countByStatus = (slug: string) =>
    couples.filter((c) => c.status === slug).length

  const hasActiveFilter = statusFilter !== 'all'
  const activeFilterLabel =
    statuses.find((s) => s.slug === statusFilter)?.name ?? statusFilter
  const activeSortLabel =
    SORT_OPTIONS.find(
      (o) => o.field === sortField && o.direction === sortDirection
    )?.label ?? ''

  return (
    <div>
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Couples</h1>
          <span className="text-sm text-gray-400">{couples.length} total</span>
        </div>
        <button
          onClick={onAddClick}
          className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition cursor-pointer"
          aria-label="New couple"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search
            size={11}
            strokeWidth={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search couples..."
            className="w-full border border-gray-200 rounded-md pl-6 pr-6 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 transition"
          />
          {search && (
            <button
              onClick={() => {
                onSearchChange('')
                searchInputRef.current?.focus()
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition cursor-pointer p-0.5"
            >
              <X size={10} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Filter button — desktop only; mobile uses status chips below */}
        <div className="relative hidden sm:block" ref={filtersRef}>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-1 border border-gray-200 rounded-md px-2 py-2 text-xs hover:bg-gray-50 transition whitespace-nowrap cursor-pointer ${
              hasActiveFilter ? 'text-gray-900 bg-gray-50' : 'text-gray-500'
            }`}
          >
            <SlidersHorizontal size={11} strokeWidth={1.5} />
            <span>{hasActiveFilter ? activeFilterLabel : 'Filter'}</span>
            {hasActiveFilter && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusFilterChange('all')
                }}
                className="ml-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X size={10} strokeWidth={1.5} />
              </span>
            )}
          </button>
          {filtersOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-32 py-1">
              <button
                onClick={() => {
                  onStatusFilterChange('all')
                  setFiltersOpen(false)
                }}
                className={`w-full text-left px-2.5 py-1.5 text-xs transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-gray-50 text-gray-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All ({couples.length})
              </button>
              {statuses.map((status) => (
                <button
                  key={status.slug}
                  onClick={() => {
                    onStatusFilterChange(status.slug)
                    setFiltersOpen(false)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs transition cursor-pointer ${
                    statusFilter === status.slug
                      ? 'bg-gray-50 text-gray-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {status.name} ({countByStatus(status.slug)})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort button */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-1 border border-gray-200 rounded-md px-2 py-2 text-xs text-gray-500 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
          >
            <ArrowUpDown size={11} strokeWidth={1.5} />
            <span>{activeSortLabel || 'Sort'}</span>
          </button>
          {sortOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-40 py-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={`${option.field}-${option.direction}`}
                  onClick={() => {
                    onSortChange(option.field, option.direction)
                    setSortOpen(false)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs transition cursor-pointer ${
                    sortField === option.field && sortDirection === option.direction
                      ? 'bg-gray-50 text-gray-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New couple button — desktop only */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onAddClick}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700 transition cursor-pointer"
          >
            <Plus size={11} strokeWidth={2} />
            New couple
          </button>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200 mt-6">
        <button
          onClick={() => onViewModeChange('list')}
          className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'list'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <List size={15} strokeWidth={1.5} /> List
        </button>
        <button
          onClick={() => onViewModeChange('kanban')}
          className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'kanban'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <LayoutGrid size={15} strokeWidth={1.5} /> Board
        </button>
      </div>

      {/* Mobile status filter chips — replaces the filter dropdown on mobile; hidden on board view */}
      <div className={`sm:hidden overflow-x-auto flex gap-2 pt-3 -mx-6 px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${viewMode === 'kanban' ? 'hidden' : ''}`}>
        <button
          onClick={() => onStatusFilterChange('all')}
          className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          All
        </button>
        {statuses.map((status) => (
          <button
            key={status.slug}
            onClick={() => onStatusFilterChange(status.slug)}
            className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
              statusFilter === status.slug
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            {status.name}
            <span className="ml-1.5 opacity-60">{countByStatus(status.slug)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
