'use client'

import { useRef, useEffect, useState } from 'react'
import { X, Trash2, Download, ChevronDown } from 'lucide-react'
import { CoupleStatusRecord, getStatusClasses } from './couples-types'

interface BulkActionBarProps {
  selectedCount: number
  statuses: CoupleStatusRecord[]
  loading: boolean
  onClearSelection: () => void
  onBulkStatusChange: (status: string) => Promise<void>
  onDeleteClick: () => void
  onExportCSV: () => void
}

export function BulkActionBar({
  selectedCount,
  statuses,
  loading,
  onClearSelection,
  onBulkStatusChange,
  onDeleteClick,
  onExportCSV,
}: BulkActionBarProps) {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    if (statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownOpen])

  if (selectedCount === 0) return null

  return (
    <div
      data-bulk-action-bar
      className="hidden sm:flex fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-2xl shadow-lg px-2 py-2 items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-sm text-gray-500 px-3 tabular-nums">{selectedCount} selected</span>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-40 cursor-pointer font-medium"
        >
          Change Status
          <ChevronDown size={13} strokeWidth={1.5} className="text-gray-400" />
        </button>

        {statusDropdownOpen && (
          <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] z-50">
            {statuses.map((status) => {
              const classes = getStatusClasses(status.color)
              return (
                <button
                  key={status.id}
                  onClick={async () => {
                    await onBulkStatusChange(status.slug)
                    setStatusDropdownOpen(false)
                  }}
                  disabled={loading}
                  className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition disabled:opacity-40 cursor-pointer"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${classes.dot}`} />
                  <span className="text-gray-700">{status.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={onExportCSV}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-40 cursor-pointer font-medium"
      >
        <Download size={14} strokeWidth={1.5} className="text-gray-400" />
        Export
      </button>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <button
        onClick={onDeleteClick}
        disabled={loading}
        className="p-1.5 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition disabled:opacity-40 cursor-pointer"
      >
        <Trash2 size={15} strokeWidth={1.5} />
      </button>

      <button
        onClick={onClearSelection}
        disabled={loading}
        className="p-1.5 rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition disabled:opacity-40 cursor-pointer"
      >
        <X size={15} strokeWidth={1.5} />
      </button>
    </div>
  )
}
