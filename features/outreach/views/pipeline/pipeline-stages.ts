/**
 * Board columns for the Pipeline view. Every label comes from the shared
 * map in `prospects/labels.ts`, so the board, the drawer and the filters
 * cannot disagree. (They once did: the board said "Already uses a CRM"
 * while the drawer said "Has a CRM" for the same lost reason.)
 *
 * @module features/outreach/views/pipeline/pipeline-stages
 */
import { STAGE_LABELS } from '../prospects/labels';

export { LOST_REASON_LABELS } from '../prospects/labels';

/** One column on the pipeline board. */
export interface BoardStage {
  id: string;
  label: string;
}

/** Board column ids in funnel order. "new" and "opted_out" are not on the board. */
const BOARD_STAGE_IDS = ['contacted', 'replied', 'demo_booked', 'demo_done', 'signed_up', 'paying', 'lost'] as const;

/** Columns in funnel order, labelled from the shared stage map. */
export const BOARD_STAGES: BoardStage[] = BOARD_STAGE_IDS.map((id) => ({ id, label: STAGE_LABELS[id] }));
