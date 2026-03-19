'use client'

import { useEffect, useRef, useState } from 'react'
import { List, LayoutGrid, Plus, Search, SlidersHorizontal, ArrowUpDown, X, Calendar } from 'lucide-react'
import {
  Couple,
  ViewMode,
  CoupleStatus,
  STATUSES,
  STATUS_LABELS,
  SortField,
  SortDirection,
  SORT_OPTIONS,
} from './couples-types'

interface CouplesHeaderProps {
  couples: Couple[]
  onAddClick: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  search: string
  onSearchChange: (search: string) => void
  statusFilter: CoupleStatus | 'all'
  onStatusFilterChange: (status: CoupleStatus | 'all') => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
}

export function CouplesHeader({
  couples,
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

  const countByStatus = (status: CoupleStatus) =>
    couples.filter((c) => c.status === status).length

  const hasActiveFilter = statusFilter !== 'all'

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Couples</h1>
          <span className="text-sm text-gray-400">{couples.length} total</span>
        </div>

        <div className="flex items-center gap-1">
          <div className="relative mr-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-56 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200"
            />
            {search && (
              <button
                onClick={() => {
                  onSearchChange('')
                  searchInputRef.current?.focus()
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
            >
              <ArrowUpDown size={16} />
            </button>
            {sortOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-48 py-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={`${option.field}-${option.direction}`}
                    onClick={() => {
                      onSortChange(option.field, option.direction)
                      setSortOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      sortField === option.field && sortDirection === option.direction
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={filtersRef}>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`p-2 rounded-lg transition cursor-pointer ${
                hasActiveFilter
                  ? 'text-gray-900 bg-gray-100'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <SlidersHorizontal size={16} />
            </button>
            {filtersOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-44 py-1">
                <button
                  onClick={() => {
                    onStatusFilterChange('all')
                    setFiltersOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-gray-50 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All ({couples.length})
                </button>
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      onStatusFilterChange(status)
                      setFiltersOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      statusFilter === status
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {STATUS_LABELS[status]} ({countByStatus(status)})
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onAddClick}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-black rounded-lg hover:bg-neutral-800 transition ml-1 cursor-pointer"
          >
            <Plus size={14} />
            New
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-gray-200 mt-6">
        <button
          onClick={() => onViewModeChange('list')}
          className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'list'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <List size={15} /> List
        </button>
        <button
          onClick={() => onViewModeChange('kanban')}
          className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'kanban'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <LayoutGrid size={15} /> Board
        </button>
        <button
          onClick={() => onViewModeChange('calendar')}
          className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'calendar'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Calendar size={15} /> Calendar
        </button>
      </div>
    </div>
  )
}
