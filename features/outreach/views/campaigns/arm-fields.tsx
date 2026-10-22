'use client';

/**
 * Pick the sequences a campaign tests against each other, with a weight
 * for each and the resulting split shown as a percentage.
 *
 * @module features/outreach/views/campaigns/arm-fields
 */
import { useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import { type DraftArm, splitPercent } from './campaign-draft';
import { parseShare } from './share-input';

interface ArmFieldsProps {
  /** Every live sequence, to choose from. */
  sequences: { id: string; name: string }[];
  arms: DraftArm[];
  onChange: (arms: DraftArm[]) => void;
}

/** Drop one key from a record without mutating it. */
function omit(record: Record<string, string>, key: string): Record<string, string> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** Checklist of sequences with weights. Unchecked sequences are not in the campaign. */
export function ArmFields({ sequences, arms, onChange }: ArmFieldsProps) {
  const split = splitPercent(arms);
  // Why: typed text per sequence, so a cleared share stays blank until a number is entered.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function toggle(id: string, on: boolean) {
    // New arms start at 50 so two picked sequences split evenly without any typing.
    if (on) onChange([...arms, { sequence_id: id, weight: 50 }]);
    else onChange(arms.filter((a) => a.sequence_id !== id));
  }

  function setWeight(id: string, weight: number) {
    onChange(arms.map((a) => (a.sequence_id === id ? { ...a, weight } : a)));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-body font-medium text-text">Sequences</p>
        <p className="text-body text-text-muted">
          Each new person is randomly assigned one sequence they can receive, so you can compare them.
        </p>
      </div>
      {sequences.length === 0 ? (
        <p className="text-body text-text-muted">No sequences yet. Create one under Sequences first.</p>
      ) : (
        <ul className="space-y-3">
          {sequences.map((seq) => {
            const arm = arms.find((a) => a.sequence_id === seq.id);
            return (
              <li key={seq.id} className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox
                  checked={!!arm}
                  onChange={(on) => toggle(seq.id, on)}
                  label={seq.name}
                  ariaLabel={`Include ${seq.name}`}
                />
                {arm && (
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        label="Share"
                        value={drafts[seq.id] ?? String(arm.weight)}
                        onBlur={() => setDrafts((d) => omit(d, seq.id))}
                        onChange={(e) => {
                          setDrafts((d) => ({ ...d, [seq.id]: e.target.value }));
                          const n = parseShare(e.target.value);
                          if (n !== null) setWeight(seq.id, n);
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-body text-text-muted tabular-nums">{split.get(seq.id) ?? 0}%</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
