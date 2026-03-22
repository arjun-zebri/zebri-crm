'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Couple, CoupleStatusRecord } from './couples-types'

interface CouplesToolbarProps {
  search: string
  onSearchChange: (search: string) => void
  statusFilter: string | 'all'
  onStatusFilterChange: (status: string | 'all') => void
  statuses: CoupleStatusRecord[]
  couples: Couple[]
}

export function CouplesToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statuses,
  couples,
}: CouplesToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const countByStatus = (slug: string) =>
    couples.filter((c) => c.status === slug).length

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={1.5} />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search couples..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
        />
      </div>

      <div className="relative" ref={filtersRef}>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl transition ${
            statusFilter !== 'all'
              ? 'border border-gray-900 bg-gray-900 text-white'
              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal size={14} strokeWidth={1.5} /> Filters
        </button>
        {filtersOpen && (
          <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-48">
            <button
              onClick={() => {
                onStatusFilterChange('all')
                setFiltersOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-sm transition ${
                statusFilter === 'all'
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
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
                className={`w-full text-left px-4 py-2 text-sm transition ${
                  statusFilter === status.slug
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {status.name} ({countByStatus(status.slug)})
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
