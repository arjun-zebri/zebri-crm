/**
 * Wording for the Activate confirmation. Pure, so every branch (counting,
 * failed, empty, normal) is covered by a unit test.
 *
 * @module features/outreach/views/campaigns/activate-copy
 */

/** Inputs the confirmation sentence depends on. */
export interface ActivateCopyInput {
  /** Matching celebrants, once counted. */
  count: number | undefined;
  counting: boolean;
  failed: boolean;
  /** The campaign's daily new enrolments. */
  dailyNew: number;
  /** Number of sequences (arms) in the campaign. */
  sequences: number;
}

/** "1 celebrant" or "3 celebrants". */
function celebrants(n: number): string {
  return `${n} ${n === 1 ? 'celebrant' : 'celebrants'}`;
}

/** "1 sequence" or "2 sequences". */
function sequenceWord(n: number): string {
  return `${n} ${n === 1 ? 'sequence' : 'sequences'}`;
}

/**
 * The confirm sentence. It states the audience size and the pace, since
 * activation starts real sends to real people.
 *
 * @param input - Count state and the campaign's pace.
 * @returns One or two plain sentences for the dialog body.
 */
export function activateDescription(input: ActivateCopyInput): string {
  const pace = `${input.dailyNew} new per day across ${sequenceWord(input.sequences)}`;
  if (input.counting) return 'Counting matching celebrants...';
  if (input.failed || input.count === undefined) {
    return `Could not count the audience just now. Start sending to this campaign's audience, ${pace}?`;
  }
  if (input.count === 0) {
    return `No active celebrants match this audience yet, so nothing will send until some do. Activate anyway? Pace: ${pace}.`;
  }
  return `Start sending to up to ${celebrants(input.count)}, ${pace}?`;
}
