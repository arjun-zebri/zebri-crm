'use client'

import { Droppable } from '@hello-pangea/dnd'
import { Plus } from 'lucide-react'
import { Couple, CoupleStatus, STATUS_LABELS, STATUS_TEXT_COLORS, STATUS_BORDER_COLORS } from './couples-types'
import { KanbanCard } from './kanban-card'

interface KanbanColumnProps {
  status: string
  couples: Couple[]
  onCardClick: (couple: Couple) => void
  onAddClick?: (status: string) => void
}

export function KanbanColumn({ status, couples, onCardClick, onAddClick }: KanbanColumnProps) {
  const textColor = STATUS_TEXT_COLORS[status as CoupleStatus] || 'text-gray-400'
  const borderColor = STATUS_BORDER_COLORS[status as CoupleStatus] || 'border-gray-300'

  return (
    <div className="w-64 flex-shrink-0 bg-gray-50 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-sm font-medium ${textColor}`}>
          {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
        </span>
        <span className="text-xs text-gray-300">{couples.length}</span>
      </div>
      <Droppable droppableId={status}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-1 min-h-[40px]"
          >
            {couples.map((couple, index) => (
              <KanbanCard
                key={couple.id}
                couple={couple}
                index={index}
                onClick={() => onCardClick(couple)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <button
        onClick={() => onAddClick?.(status)}
        className={`flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition mt-2 py-1.5 px-2.5 rounded-lg border ${borderColor} bg-white hover:bg-gray-50 cursor-pointer`}
      >
        <Plus size={14} />
        New
      </button>
    </div>
  )
}
