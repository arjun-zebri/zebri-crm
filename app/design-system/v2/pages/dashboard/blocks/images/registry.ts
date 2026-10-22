import type { ComponentType } from 'react';

import { BdmImage } from './bdm';
import { CalendarImage } from './calendar';
import { ContractsImage } from './contracts';
import { JourneysImage } from './journeys';
import { LeadCaptureImage } from './lead-capture';
import { PaymentsImageA } from './payments';
import { ProposalsImage } from './proposals';
import { QuestionnairesImage } from './questionnaires';
import { SchedulerImageF } from './scheduler';
import { ScriptsImage } from './scripts';
import { TimelineImage } from './timeline';
import { VideoImage } from './video';

/**
 * Each block's product image, by block id (the ids in `../catalog.ts`).
 * A single component is a finished image. An object is a round of drafts
 * from `/new-block-image`, keyed by their letter (`{ D: …, E: … }`), which
 * the detail view shows with a switcher until one is picked. Keying by
 * letter keeps a later round's letters (D, E) as the skill names them. A block left out shows the placeholder.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/registry
 */

/** A finished image, or the drafts being chosen between. */
export type BlockImageEntry = ComponentType | Readonly<Record<string, ComponentType>>;

/** Block id to its image. Add entries here as `/new-block-image` makes them. */
export const BLOCK_IMAGES: Partial<Record<string, BlockImageEntry>> = {
  bdm: BdmImage,
  calendar: CalendarImage,
  contracts: ContractsImage,
  'lead-capture': LeadCaptureImage,
  payments: { A: PaymentsImageA },
  proposals: ProposalsImage,
  questionnaires: QuestionnairesImage,
  scheduler: { F: SchedulerImageF },
  scripts: ScriptsImage,
  timeline: TimelineImage,
  video: VideoImage,
  workflows: JourneysImage,
};

/** True when the entry is a round of drafts rather than a finished image. */
export const isDrafts = (entry: BlockImageEntry): entry is Readonly<Record<string, ComponentType>> =>
  typeof entry !== 'function';
