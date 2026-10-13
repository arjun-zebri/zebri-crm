/**
 * The verdict as a pill. Colour carries the call the founder cares about:
 * active is the good state, needs review is the one to look at, and
 * unchecked is hollow to say "nothing decided yet".
 *
 * @module features/outreach/views/prospects/verdict-pill
 */
import { StatePill, type StatePillTone } from '@/components/ui/state-pill';

import { VERDICT_LABELS } from './labels';

const TONE: Record<string, StatePillTone> = {
  active: 'success',
  inactive: 'neutral',
  needs_review: 'warning',
  unchecked: 'neutral',
};

/** Props for {@link VerdictPill}. */
export interface VerdictPillProps {
  verdict: string;
}

/** Verdict pill with the house tone and dot for each verdict. */
export function VerdictPill({ verdict }: VerdictPillProps) {
  const hollow = verdict === 'unchecked';
  return (
    <StatePill
      label={VERDICT_LABELS[verdict] ?? verdict}
      tone={TONE[verdict] ?? 'neutral'}
      dot={verdict === 'active' ? 'filled' : hollow ? 'hollow' : false}
    />
  );
}
