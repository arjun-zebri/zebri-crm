/**
 * The prospect's place in the pipeline: stage and reply sentiment, plus
 * why a lead was lost once it is. These are the two things the founder
 * changes most, so they sit above the tabs in the prospect modal. Selects
 * save on change and confirm with a toast.
 *
 * @module features/outreach/views/prospects/drawer-pipeline
 */
import { Select, type SelectOption } from '@/components/ui/select';
import { LOST_REASONS, STAGES, type Prospect } from '@/lib/outreach/types';

import { LOST_REASON_LABELS, STAGE_LABELS, stageLabel } from './labels';
import { usePatchProspect } from './use-patch-prospect';

/** Sentinel for "not set". Select cannot hold an empty string value. */
const NONE = 'none';

const STAGE_OPTIONS: SelectOption[] = STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }));
const SENTIMENT_OPTIONS: SelectOption[] = [
  { value: NONE, label: 'Not set' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
];
const LOST_OPTIONS: SelectOption[] = [
  { value: NONE, label: 'Not set' },
  ...LOST_REASONS.map((r) => ({ value: r, label: LOST_REASON_LABELS[r] })),
];

/** Props for {@link PipelineFields}. */
export interface PipelineFieldsProps {
  prospect: Prospect;
  /** Whether they have replied. Sentiment only means something after a reply, so it hides until then. */
  hasReplied: boolean;
}

/** Stage, then reply sentiment once they have replied, then lost reason once lost. */
export function PipelineFields({ prospect: p, hasReplied }: PipelineFieldsProps) {
  const { patch } = usePatchProspect(p.id);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select
        label="Stage"
        options={STAGE_OPTIONS}
        value={p.stage}
        onValueChange={(stage) => patch({ stage }, `Stage set to ${stageLabel(stage)}`)}
      />
      {(hasReplied || p.reply_sentiment) && (
        <Select
          label="How was the reply?"
          options={SENTIMENT_OPTIONS}
          value={p.reply_sentiment ?? NONE}
          onValueChange={(v) => patch({ reply_sentiment: v === NONE ? null : v }, 'Reply sentiment saved')}
        />
      )}
      {p.stage === 'lost' && (
        <Select
          label="Why lost"
          options={LOST_OPTIONS}
          value={p.lost_reason ?? NONE}
          onValueChange={(v) => patch({ lost_reason: v === NONE ? null : v }, 'Lost reason saved')}
        />
      )}
    </div>
  );
}
