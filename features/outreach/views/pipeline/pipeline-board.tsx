'use client';

/**
 * The pipeline board: one column per stage, drag a card to move it.
 *
 * Dropping on "Lost" is not a plain move. The parent handles it, because
 * a lost prospect needs a reason. The board only reports the drop.
 *
 * @module features/outreach/views/pipeline/pipeline-board
 */
import {
  DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, KeyboardSensor, PointerSensor, useDroppable,
  useSensor, useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';

import type { ProspectRow } from '@/lib/outreach/services/queries';

import { BOARD_STAGES, type BoardStage } from './pipeline-stages';
import { DraggableProspectCard, ProspectCardBody } from './prospect-card';

interface PipelineBoardProps {
  rows: ProspectRow[];
  /** Called when a card is moved to a different column, by drag or by its menu. */
  onMove: (row: ProspectRow, stage: string) => void;
}

/**
 * Columns sit side by side and scroll sideways on a phone. The pointer
 * sensor waits for a few pixels of movement, so a tap still opens the
 * prospect instead of starting a drag. The keyboard sensor lets a focused
 * grip handle be picked up with Space and moved with the arrow keys.
 */
export function PipelineBoard({ rows, onMove }: PipelineBoardProps) {
  const [active, setActive] = useState<ProspectRow | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    setActive(null);
    const row = rows.find((r) => r.id === event.active.id);
    const target = event.over?.id;
    if (!row || typeof target !== 'string' || target === row.stage) return;
    onMove(row, target);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActive(rows.find((r) => r.id === e.active.id) ?? null)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_STAGES.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            rows={rows.filter((r) => r.stage === stage.id)}
            onMove={onMove}
          />
        ))}
      </div>
      <DragOverlay>{active ? <div className="w-56"><ProspectCardBody row={active} /></div> : null}</DragOverlay>
    </DndContext>
  );
}

/** Props for {@link Column}. */
interface ColumnProps {
  stage: BoardStage;
  rows: ProspectRow[];
  onMove: (row: ProspectRow, stage: string) => void;
}

/** One stage column. It is the drop target. */
function Column({ stage, rows, onMove }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section aria-label={stage.label} className="w-56 shrink-0 space-y-2">
      <header className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-body font-medium text-text">{stage.label}</h2>
        <span className="text-body text-text-muted tabular-nums">{rows.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={`min-h-32 space-y-2 rounded-control p-2 ${isOver ? 'bg-surface-emphasis' : 'bg-surface-muted'}`}
      >
        {rows.map((row) => (
          <DraggableProspectCard key={row.id} row={row} onMoveTo={(target) => onMove(row, target)} />
        ))}
        {rows.length === 0 && <p className="px-1 text-body text-text-subtle">Nothing here yet.</p>}
      </div>
    </section>
  );
}
