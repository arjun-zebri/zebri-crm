import { STAGES, type Client, type Stage } from './clients-data';

/**
 * Where a client is on the booking path: the stage name and how long
 * they have sat there, over a hairline bar of seven short segments,
 * filled up to the current stage. Deliberately quiet (the first version,
 * dots joined by a black line on every row, was the loudest thing on
 * the page). Read aloud as one sentence, since the bar means nothing on
 * its own.
 *
 * @module app/design-system/v2/pages/dashboard/clients/stage-track
 */

/** The stage track for one client. */
export function StageTrack({ client }: { client: Client }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="flex items-baseline gap-2 type-body">
        <span className="shrink-0 text-zebra-950">{client.stage}</span>
        <span className="truncate text-zebra-400">{client.since}</span>
      </p>
      <StageBar stage={client.stage} />
    </div>
  );
}

/** The seven-segment bar alone, filled up to `stage`. Shared with the profile. */
export function StageBar({ stage }: { stage: Stage }) {
  const at = STAGES.indexOf(stage);
  return (
    <div role="img" aria-label={`Stage ${at + 1} of ${STAGES.length}`} className="flex gap-0.5">
      {STAGES.map((s, i) => (
        <span
          key={s}
          className={`h-0.5 flex-1 rounded-pill ${i <= at ? 'bg-zebra-700' : 'bg-zebra-200'}`}
        />
      ))}
    </div>
  );
}
