'use client'

import { List, LayoutGrid } from 'lucide-react'
import { Couple, ViewMode } from './couples-types'

interface CouplesHeaderProps {
  couples: Couple[]
  onAddClick: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function CouplesHeader({ couples, onAddClick, viewMode, onViewModeChange }: CouplesHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Couples</h1>
          <span className="text-sm text-gray-400">{couples.length} total</span>
        </div>
      </div>
      <div className="flex items-center gap-6 border-b border-gray-200 pt-2">
        <button
          onClick={() => onViewModeChange('list')}
          className={`pb-2.5 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 ${
            viewMode === 'list'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <List size={16} /> List
        </button>
        <button
          onClick={() => onViewModeChange('kanban')}
          className={`pb-2.5 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 ${
            viewMode === 'kanban'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <LayoutGrid size={16} /> Board
        </button>
      </div>
    </div>
  )
}
