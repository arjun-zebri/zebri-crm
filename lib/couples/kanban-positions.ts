/**
 * Pure helpers for computing kanban drop positions.
 *
 * The `/couples` kanban uses fractional `kanban_position` values so
 * a drop between two existing cards doesn't force a full re-shuffle
 * — we slot in at the midpoint and avoid touching every other row.
 *
 * Extracted from `app/(dashboard)/couples/page.tsx` so the math is
 * unit-testable in isolation from React + dnd-kit.
 *
 * @module lib/couples/kanban-positions
 */
import type { Couple, CoupleStatusRecord } from '@/types/couple';

export interface KanbanUpdate {
  id: string;
  status: string;
  kanban_position: number;
}

/**
 * Given a drop target, return the per-row position updates needed to
 * reflect the drag. Handles single + multi-drag. Returns an empty
 * array when the drag is a no-op (single drag onto its current
 * position within the same column).
 */
export function computeKanbanUpdates(args: {
  couples: Couple[];
  statuses: CoupleStatusRecord[];
  source: string;
  destination: string;
  destinationIndex: number;
  coupleId: string;
  selectedAtStart: Set<string>;
}): KanbanUpdate[] {
  const {
    couples,
    statuses,
    source,
    destination,
    destinationIndex,
    coupleId,
    selectedAtStart,
  } = args;

  const couple = couples.find((c) => c.id === coupleId);
  if (!couple) return [];

  const isMultiDrag =
    selectedAtStart.has(coupleId) && selectedAtStart.size > 1;
  const movingIds = isMultiDrag ? new Set(selectedAtStart) : new Set([coupleId]);

  const draggedCouples = couples.filter((c) => movingIds.has(c.id));
  const orderedDragged = [...draggedCouples].sort((a, b) => {
    const aStatusIdx = statuses.findIndex((s) => s.slug === a.status);
    const bStatusIdx = statuses.findIndex((s) => s.slug === b.status);
    if (aStatusIdx !== bStatusIdx) return aStatusIdx - bStatusIdx;
    return (a.kanban_position ?? 0) - (b.kanban_position ?? 0);
  });

  const destColumn = couples
    .filter((c) => c.status === destination && !movingIds.has(c.id))
    .sort((a, b) => (a.kanban_position ?? 0) - (b.kanban_position ?? 0));

  const count = orderedDragged.length;
  let basePosition: number;
  let stepSize: number;
  if (destColumn.length === 0) {
    basePosition = 0;
    stepSize = 1;
  } else if (destinationIndex <= 0) {
    // destColumn.length > 0 here, so [0] is defined; the `?? 0`
    // satisfies noUncheckedIndexedAccess.
    const firstPos = destColumn[0]?.kanban_position ?? 0;
    basePosition = firstPos - count;
    stepSize = 1;
  } else if (destinationIndex >= destColumn.length) {
    const lastPos =
      destColumn[destColumn.length - 1]?.kanban_position ?? 0;
    basePosition = lastPos + 1;
    stepSize = 1;
  } else {
    const prev = destColumn[destinationIndex - 1]?.kanban_position ?? 0;
    const next = destColumn[destinationIndex]?.kanban_position ?? 0;
    stepSize = (next - prev) / (count + 1);
    basePosition = prev + stepSize;
  }

  // No-op single drag onto current slot — return empty so the page
  // can skip the round-trip.
  if (
    !isMultiDrag &&
    source === destination &&
    couple.kanban_position === basePosition
  ) {
    return [];
  }

  return orderedDragged.map((c, idx) => ({
    id: c.id,
    status: destination,
    kanban_position: basePosition + idx * stepSize,
  }));
}
