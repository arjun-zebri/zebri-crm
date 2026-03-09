'use client'

import { Draggable } from '@hello-pangea/dnd'
import { Calendar, MapPin } from 'lucide-react'
import { Couple, STATUS_LABELS } from './couples-types'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface KanbanCardProps {
  couple: Couple
  index: number
  onClick: () => void
}

export function KanbanCard({ couple, index, onClick }: KanbanCardProps) {
  return (
    <Draggable draggableId={couple.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white border border-gray-200 rounded-lg p-3 transition cursor-pointer ${
            snapshot.isDragging
              ? 'shadow-lg rotate-1 scale-[1.02]'
              : 'shadow-sm hover:border-gray-300 hover:shadow-md'
          }`}
        >
          <Badge variant={couple.status}>{STATUS_LABELS[couple.status]}</Badge>
          <div className="font-medium text-sm text-gray-900 mb-2 mt-1.5">{couple.name}</div>

          {couple.event_date && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
              <Calendar size={12} />
              {formatDate(couple.event_date)}
            </div>
          )}

          {couple.venue && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
              <MapPin size={12} className="flex-shrink-0" />
              <span className="truncate">{couple.venue}</span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}
