'use client';

/**
 * A prospect on the pipeline board.
 *
 * The card has three controls, and only one of them drags: a grip handle
 * (the only element carrying dnd-kit's listeners and `touch-none`), the
 * name link that opens the prospect, and a "Move to" menu that is the
 * non-drag route for phones and keyboards. Keeping the link free of drag
 * listeners lets a finger scroll the page over the card instead of
 * dragging it.
 *
 * @module features/outreach/views/pipeline/prospect-card
 */
import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { type RowAction, RowActionsMenu } from '@/components/ui/row-actions-menu';
import type { ProspectRow } from '@/lib/outreach/services/queries';

import { BOARD_STAGES } from './pipeline-stages';

/**
 * Where a card links: the prospect modal, opened on this prospect. It keeps
 * `board=1` so the prospect modal opens over the board the founder came from, not
 * over the table.
 */
export function prospectHref(id: string): string {
  return `/admin/outreach?view=prospects&board=1&prospect=${id}`;
}

/** Surface, border and shadow shared by a card on the board and in the drag overlay. */
const CARD_CHROME = 'flex items-center gap-1 rounded-control border border-border bg-card shadow-sm';

/** The text on a card: name, place and activity. */
function ProspectCardText({ row }: { row: ProspectRow }) {
  const place = [row.suburb, row.state].filter(Boolean).join(', ');
  return (
    <>
      <p className="text-body font-medium text-text truncate">{row.full_name}</p>
      {place && <p className="text-body text-text-muted truncate">{place}</p>}
      {row.activity_score !== null && <p className="text-body text-text-subtle tabular-nums">Activity {row.activity_score}</p>}
    </>
  );
}

/**
 * The card as the drag overlay draws it. No handle, no link, and no
 * listeners: the overlay is a picture of the card, not a second draggable.
 */
export function ProspectCardBody({ row }: { row: ProspectRow }) {
  return (
    <div className={`${CARD_CHROME} px-3`}>
      <div className="min-w-0 flex-1 space-y-1 py-3">
        <ProspectCardText row={row} />
      </div>
    </div>
  );
}

/** Props for {@link DraggableProspectCard}. */
export interface DraggableProspectCardProps {
  row: ProspectRow;
  /** Moves this card to a stage. The parent decides what "Lost" needs (a reason). */
  onMoveTo: (stage: string) => void;
}

/** A card on the board: drag by the handle, open by the name, or move from the menu. */
export function DraggableProspectCard({ row, onMoveTo }: DraggableProspectCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: row.id });

  // The current stage is left out: moving a card to where it already is does nothing.
  const moveActions: RowAction[] = BOARD_STAGES.filter((s) => s.id !== row.stage).map((s) => ({
    label: `Move to ${s.label}`,
    onSelect: () => onMoveTo(s.id),
  }));

  return (
    <div ref={setNodeRef} className={`${CARD_CHROME} pr-1 ${isDragging ? 'opacity-40' : ''}`}>
      <Button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        variant="ghost"
        iconOnly
        aria-label={`Move ${row.full_name}`}
        className="touch-none"
      >
        <GripVertical size={14} strokeWidth={1.5} aria-hidden="true" />
      </Button>
      <Link href={prospectHref(row.id)} draggable={false} className="block min-w-0 flex-1 cursor-pointer space-y-1 py-3">
        <ProspectCardText row={row} />
      </Link>
      <RowActionsMenu actions={moveActions} alwaysVisible size="sm" label={`More actions for ${row.full_name}`} />
    </div>
  );
}
