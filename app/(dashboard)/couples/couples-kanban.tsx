'use client'

import { memo } from 'react'
import { DragDropContext, DropResult } from '@hello-pangea/dnd'
import { Couple, STATUSES } from './couples-types'
import { KanbanColumn } from './kanban-column'

interface CouplesKanbanProps {
  couples: Couple[]
  onCardClick: (couple: Couple) => void
  onDragEnd: (source: string, destination: string, coupleId: string) => void
  onAddClick?: (status: string) => void
}

const MemoKanbanColumn = memo(KanbanColumn)

export function CouplesKanban({ couples, onCardClick, onDragEnd, onAddClick }: CouplesKanbanProps) {
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result

    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    onDragEnd(source.droppableId, destination.droppableId, draggableId)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-5 overflow-x-auto pb-4 h-full">
        {STATUSES.map((status) => (
          <MemoKanbanColumn
            key={status}
            status={status}
            couples={couples.filter((c) => c.status === status)}
            onCardClick={onCardClick}
            onAddClick={onAddClick}
          />
        ))}
      </div>
    </DragDropContext>
  )
}
