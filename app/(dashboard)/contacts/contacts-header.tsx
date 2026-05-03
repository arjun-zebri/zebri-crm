'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
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
} from './contacts-types'

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

  return (
    <div>
      <div className="flex items-center flex-wrap gap-x-1 gap-y-3">
        {/* Title */}
        <div className="flex items-baseline gap-3 flex-none sm:order-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Contacts</h1>
        </div>

        {/* Desktop spacer */}
        <div className="hidden sm:block sm:flex-1 sm:order-2" />

        {/* Search — wraps to full-width row on mobile */}
        <div className="relative order-last w-full sm:order-3 sm:w-auto sm:mr-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={1.5} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200"
          />
          {search && (
            <button
              onClick={() => {
                onSearchChange('')
                searchInputRef.current?.focus()
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto sm:ml-0 sm:order-4">
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
            >
              <ArrowUpDown size={16} strokeWidth={1.5} />
            </button>
            {sortOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-48 py-1">
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
              className={`p-2 rounded-xl transition cursor-pointer ${
                hasActiveFilter
                  ? 'text-gray-900 bg-gray-100'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} />
            </button>
            {filtersOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-48 py-1">
                <button
                  onClick={() => {
                    onFilterChange(null)
                    setFiltersOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                    categoryFilter === null && statusFilter === null
                      ? 'bg-gray-50 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
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
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      categoryFilter === category
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {CATEGORY_LABELS[category]} ({countByCategory(category)})
                  </button>
                ))}

                <div className="border-t border-gray-200 my-1" />

                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      onFilterChange({ type: 'status', value: status })
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
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-black rounded-xl hover:bg-neutral-800 transition cursor-pointer ml-1"
          >
            <Plus size={14} strokeWidth={1.5} />
            New
          </button>
        </div>
      </div>
    </div>
  )
}
