'use client'

import { Plus, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { MenuItem, MenuPanel, MenuSeparator } from '@/components/ui/menu'
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
          <Button onClick={onAddClick} iconOnly className="sm:hidden" aria-label="New contact">
            <Plus size={16} strokeWidth={1.5} />
          </Button>
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
            // Matches `Input size="sm"` exactly. Not the primitive itself:
            // this field carries a leading icon and a trailing clear button,
            // and Input has no prefix/suffix slot yet.
            className="block h-8 w-full rounded-control border border-border bg-surface pl-6 pr-6 text-body text-text transition-colors placeholder:text-text-subtle focus-visible:border-brand-fg focus-visible:outline-none"
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
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`whitespace-nowrap ${hasActiveFilter ? 'bg-surface-emphasis' : ''}`}
          >
            <SlidersHorizontal size={11} strokeWidth={1.5} />
            <span>{hasActiveFilter ? activeFilterLabel : 'Filter'}</span>
            {hasActiveFilter && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onFilterChange(null)
                }}
                className="ml-0.5 cursor-pointer text-text-subtle hover:text-text"
              >
                <X size={10} strokeWidth={1.5} />
              </span>
            )}
          </Button>
          {filtersOpen && (
            <div className="absolute left-0 top-full z-20 mt-1">
              <MenuPanel>
                <MenuItem
                  size="sm"
                  selected={categoryFilter === null && statusFilter === null}
                  onClick={() => {
                    onFilterChange(null)
                    setFiltersOpen(false)
                  }}
                >
                  All ({vendors.length})
                </MenuItem>

                {CATEGORIES.map((category) => (
                  <MenuItem
                    key={category}
                    size="sm"
                    selected={categoryFilter === category}
                    onClick={() => {
                      onFilterChange({ type: 'category', value: category })
                      setFiltersOpen(false)
                    }}
                  >
                    {CATEGORY_LABELS[category]} ({countByCategory(category)})
                  </MenuItem>
                ))}

                <MenuSeparator />

                {STATUSES.map((status) => (
                  <MenuItem
                    key={status}
                    size="sm"
                    selected={statusFilter === status}
                    onClick={() => {
                      onFilterChange({ type: 'status', value: status })
                      setFiltersOpen(false)
                    }}
                  >
                    {STATUS_LABELS[status]} ({countByStatus(status)})
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>
          )}
        </div>

        {/* Sort button */}
        <div className="relative" ref={sortRef}>
          <Button
            variant="outline"
            onClick={() => setSortOpen(!sortOpen)}
            className="whitespace-nowrap"
          >
            <ArrowUpDown size={11} strokeWidth={1.5} />
            <span>{activeSortLabel || 'Sort'}</span>
          </Button>
          {sortOpen && (
            <div className="absolute left-0 top-full z-20 mt-1">
              <MenuPanel>
                {SORT_OPTIONS.map((option) => (
                  <MenuItem
                    key={`${option.field}-${option.direction}`}
                    size="sm"
                    selected={sortField === option.field && sortDirection === option.direction}
                    onClick={() => {
                      onSortChange(option.field, option.direction)
                      setSortOpen(false)
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>
          )}
        </div>

        {/* New contact button - desktop only */}
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={onAddClick} className="hidden sm:inline-flex">
            <Plus size={11} strokeWidth={1.5} />
            New contact
          </Button>
        </div>
      </div>
    </div>
  )
}
