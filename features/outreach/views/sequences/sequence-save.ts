/**
 * Turns a sequence draft into the saveSequenceAction payload, and lists
 * the problems that should block saving.
 *
 * @module features/outreach/views/sequences/sequence-save
 */
import { type DraftSequence, type Channel, startsThread } from './sequence-draft';

/** Payload for saveSequenceAction, matching saveSequenceSchema. */
export interface SaveSequencePayload {
  id?: string;
  name: string;
  steps: {
    id?: string;
    channel: Channel;
    delay_days: number;
    is_new_thread: boolean;
    variants: {
      id?: string;
      label: string;
      subject: string | null;
      body: string;
      weight: number;
      active: boolean;
    }[];
  }[];
}

/**
 * Plain-language problems that would make the save fail or the sequence
 * unsendable. The editor disables Save while this list is not empty.
 * Merge-field typos are warnings instead (see variant-preview.ts), since
 * they render as a visible gap rather than breaking the save.
 */
export function draftProblems(draft: DraftSequence): string[] {
  const problems: string[] = [];
  if (!draft.name.trim()) problems.push('Name the sequence.');
  if (draft.steps.length === 0) problems.push('Add at least one step.');
  draft.steps.forEach((step, i) => {
    const n = i + 1;
    if (step.variants.length === 0) problems.push(`Step ${n} needs at least one message.`);
    if (step.variants.some((v) => !v.body.trim())) problems.push(`Step ${n} has an empty message.`);
    if (startsThread(step, i) && step.variants.some((v) => !v.subject.trim())) {
      problems.push(`Step ${n} needs a subject because it starts a new email thread.`);
    }
  });
  return problems;
}

/**
 * Convert a draft into the saveSequenceAction payload.
 *
 * Labels are assigned here from position, so removing variant A makes
 * B the new A. Ids are only included when they exist, so new rows are
 * created and existing rows are updated in place.
 */
export function toSavePayload(draft: DraftSequence): SaveSequencePayload {
  return {
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name.trim(),
    steps: draft.steps.map((step, i) => {
      const email = step.channel === 'email';
      return {
        ...(step.id ? { id: step.id } : {}),
        channel: step.channel,
        delay_days: step.delay_days,
        is_new_thread: startsThread(step, i),
        variants: step.variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          label: v.label,
          // Instagram has no subject line. Blank email subjects on follow-ups are stored as null.
          subject: email && v.subject.trim() ? v.subject.trim() : null,
          body: v.body,
          weight: v.weight,
          active: v.active,
        })),
      };
    }),
  };
}
