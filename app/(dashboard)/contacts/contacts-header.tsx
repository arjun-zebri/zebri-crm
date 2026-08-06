'use client'

import { Plus, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { PageHeader } from '@/components/ui/page-header'
import {
  Contact,
  ContactCategory,
  ContactStatus,
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
  SortField,
  SortDirection,
  SORT_OPTIONS,
} from '@/types/contact'

interface ContactsHeaderProps {
  vendors: Contact[]
  onAddClick: () => void
  search: string
  onSearchChange: (search: string) => void
  categoryFilter: ContactCategory | null
  statusFilter: ContactStatus | null
  onFilterChange: (filter: { type: 'category'; value: ContactCategory } | { type: 'status'; value: ContactStatus } | null) => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
}

export function ContactsHeader({
  vendors,
  onAddClick,
  search,
  onSearchChange,
  categoryFilter,
  statusFilter,
  onFilterChange,
  sortField,
  sortDirection,
  onSortChange,
}: ContactsHeaderProps) {
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

  const countByCategory = (category: ContactCategory) =>
    vendors.filter((v) => v.category === category).length

  const countByStatus = (status: ContactStatus) =>
    vendors.filter((v) => v.status === status).length

  const hasActiveFilter = categoryFilter !== null || statusFilter !== null

  const activeFilterLabel =
    categoryFilter !== null
      ? CATEGORY_LABELS[categoryFilter]
      : statusFilter !== null
      ? STATUS_LABELS[statusFilter]
      : null

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.field === sortField && o.direction === sortDirection)?.label ?? ''

  return (
    <div>
      <PageHeader
        title="Contacts"
        count={vendors.length}
        className="mb-4"
        actions={
          <button
            onClick={onAddClick}
            className="sm:hidden flex items-center justify-center w-8 h-8 rounded-pill bg-gray-900 text-white hover:bg-gray-700 transition cursor-pointer"
            aria-label="New contact"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search
            size={11}
            strokeWidth={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search contacts..."
            className="w-full border border-border rounded-control pl-6 pr-6 py-2 text-xs text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong transition"
          />
          {search && (
            <button
              onClick={() => {
                onSearchChange('')
                searchInputRef.current?.focus()
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-gray-700 transition cursor-pointer p-0.5"
            >
              <X size={10} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Filter button */}
        <div className="relative" ref={filtersRef}>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-1 border border-border rounded-control px-2 py-2 text-xs hover:bg-gray-50 transition whitespace-nowrap cursor-pointer ${
              hasActiveFilter ? 'text-text bg-gray-50' : 'text-text-muted'
            }`}
          >
            <SlidersHorizontal size={11} strokeWidth={1.5} />
            <span>{hasActiveFilter ? activeFilterLabel : 'Filter'}</span>
            {hasActiveFilter && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onFilterChange(null)
                }}
                className="ml-0.5 text-text-subtle hover:text-gray-700 cursor-pointer"
              >
                <X size={10} strokeWidth={1.5} />
              </span>
            )}
          </button>
          {filtersOpen && (
            <div className="absolute top-full mt-1 left-0 bg-surface border border-border rounded-control shadow-lg z-20 min-w-36 py-1">
              <button
                onClick={() => {
                  onFilterChange(null)
                  setFiltersOpen(false)
                }}
                className={`w-full text-left px-2.5 py-1.5 text-xs transition cursor-pointer ${
                  categoryFilter === null && statusFilter === null
                    ? 'bg-gray-50 text-text font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All ({vendors.length})
              </button>

              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    onFilterChange({ type: 'category', value: category })
                    setFiltersOpen(false)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs transition cursor-pointer ${
                    categoryFilter === category
                      ? 'bg-gray-50 text-text font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {CATEGORY_LABELS[category]} ({countByCategory(category)})
                </button>
              ))}

              <div className="border-t border-border my-1" />

              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    onFilterChange({ type: 'status', value: status })
                    setFiltersOpen(false)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs transition cursor-pointer ${
                    statusFilter === status
                      ? 'bg-gray-50 text-text font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {STATUS_LABELS[status]} ({countByStatus(status)})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort button */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-1 border border-border rounded-control px-2 py-2 text-xs text-text-muted hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
          >
            <ArrowUpDown size={11} strokeWidth={1.5} />
            <span>{activeSortLabel || 'Sort'}</span>
          </button>
          {sortOpen && (
            <div className="absolute top-full mt-1 left-0 bg-surface border border-border rounded-control shadow-lg z-20 min-w-40 py-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={`${option.field}-${option.direction}`}
                  onClick={() => {
                    onSortChange(option.field, option.direction)
                    setSortOpen(false)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs transition cursor-pointer ${
                    sortField === option.field && sortDirection === option.direction
                      ? 'bg-gray-50 text-text font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New contact button - desktop only */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onAddClick}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-xs rounded-control hover:bg-gray-700 transition cursor-pointer"
          >
            <Plus size={11} strokeWidth={2} />
            New contact
          </button>
        </div>
      </div>
    </div>
  )
}
