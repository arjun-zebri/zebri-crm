'use client';

/**
 * Audience inputs for a campaign, with a live count of matching celebrants.
 *
 * @module features/outreach/views/campaigns/audience-fields
 */
import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';

import { STATE_OPTIONS, audienceOf, type AudiencePayload } from './campaign-draft';
import { useAudienceCount } from './use-audience-count';

const STATE_SELECT = STATE_OPTIONS.map((s) => ({ value: s, label: s }));

/** Waits until the value stops changing, so typing a score doesn't fire a query per key. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

interface AudienceFieldsProps {
  states: string[];
  minScore: number | null;
  onStates: (states: string[]) => void;
  onMinScore: (score: number | null) => void;
}

/** States, minimum score, and the live count under them. */
export function AudienceFields({ states, minScore, onStates, onMinScore }: AudienceFieldsProps) {
  const audience = audienceOf({ states, minScore });
  // Why: the key is a string so the debounce compares by value, not by object identity.
  const audienceKey = JSON.stringify(audience);
  const debouncedKey = useDebounced(audienceKey, 300);
  const count = useAudienceCount(JSON.parse(debouncedKey) as AudiencePayload, true);

  return (
    <div className="space-y-3">
      <p className="text-body font-medium text-text">Audience</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <MultiSelect
          label="States"
          ariaLabel="States"
          options={STATE_SELECT}
          value={states}
          onValueChange={onStates}
          placeholder="All states"
          help="Leave empty for every state."
        />
        <Input
          label="Minimum activity (0 to 100)"
          type="number"
          min={0}
          max={100}
          value={minScore ?? ''}
          placeholder="No minimum"
          help="Score from 0 to 100, built from each celebrant's website and Instagram activity checks. Higher means more active. Leave blank for no minimum."
          onChange={(e) => {
            if (e.target.value === '') return onMinScore(null);
            const n = Number(e.target.value);
            onMinScore(Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null);
          }}
        />
      </div>
      <p aria-live="polite" className="text-body text-text-muted">
        {count.isPending
          ? 'Counting matching celebrants...'
          : count.isError
            ? 'Could not count the audience.'
            : count.data === 1
              ? '1 celebrant with Active status matches'
              : `${count.data} celebrants with Active status match`}
      </p>
    </div>
  );
}
