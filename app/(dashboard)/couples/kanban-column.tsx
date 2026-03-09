'use client'

import { Droppable } from '@hello-pangea/dnd'
import { Plus } from 'lucide-react'
import { Couple, CoupleStatus, STATUS_LABELS, STATUS_DOT_COLORS } from './couples-types'
import { KanbanCard } from './kanban-card'

interface KanbanColumnProps {
  status: string
  couples: Couple[]
  onCardClick: (couple: Couple) => void
  onAddClick?: (status: string) => void
}

export function KanbanColumn({ status, couples, onCardClick, onAddClick }: KanbanColumnProps) {
  const dotColor = STATUS_DOT_COLORS[status as CoupleStatus] || 'bg-gray-400'

  return (
    <div className="w-64 flex-shrink-0 bg-gray-100 rounded-xl p-3 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-sm font-medium text-gray-900">
          {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
        </span>
        <span className="text-xs text-gray-400">{couples.length}</span>
        <div className="flex-1" />
        <button
          onClick={() => onAddClick?.(status)}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <Plus size={16} />
        </button>
      </div>
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-2 min-h-[200px] rounded-lg flex-1 overflow-y-auto"
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
    </div>
  )
}
