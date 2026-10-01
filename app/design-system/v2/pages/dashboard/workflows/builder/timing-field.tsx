'use client';

import { Dropdown } from '@/components/ui-v2/dropdown';
import { InlineInput } from '@/components/ui-v2/inline-input';

import type { Timing } from '../model';

import { PropRow } from './prop-row';

/**
 * When a step happens, as one sentence of controls: "2 days after the
 * last step", "8 weeks before the event", or "Straight away". The mode
 * is the sentence's last word rather than a separate dropdown above it,
 * so nothing is said twice. The three timing modes of the real engine,
 * without its words (`after_previous`, `wedding_relative`). Minutes and
 * hours only make sense after the step before, so the unit list follows
 * the mode; days, weeks and months work for both.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/timing-field
 */

const MODES = [
  { value: 'now', label: 'straight away' },
  { value: 'after', label: 'after the last step' },
  { value: 'before-event', label: 'before the event' },
  { value: 'after-event', label: 'after the event' },
];
// Alone, "Straight away" starts the sentence, so it takes the capital.
const MODES_NOW = MODES.map((m) => ({ ...m, label: m.label.charAt(0).toUpperCase() + m.label.slice(1) }));

const UNITS = ['minutes', 'hours', 'days', 'weeks', 'months'].map((u) => ({ value: u, label: u }));

export interface TimingFieldProps {
  value: Timing;
  onChange: (t: Timing) => void;
}

/** The timing row. See {@link TimingFieldProps}. */
export function TimingField({ value: t, onChange }: TimingFieldProps) {
  const setMode = (mode: string) => {
    if (mode === 'now') return onChange({ mode: 'now' });
    const n = t.mode === 'now' ? 2 : t.n;
    if (mode === 'after') return onChange({ mode: 'after', n, unit: t.mode === 'now' ? 'days' : t.unit });
    onChange({ mode: mode as 'before-event', n, unit: t.mode !== 'now' && (t.unit === 'weeks' || t.unit === 'months') ? t.unit : 'days' });
  };
  return (
    <PropRow label="When">
      {t.mode === 'now' ? null : (
        <>
          {/* A soft tint, the same as the inline pickers' hover, marks the
              number as editable without a box or an underline. */}
          <InlineInput
            aria-label="How many"
            inputMode="numeric"
            value={String(t.n)}
            onChange={(e) => onChange({ ...t, n: Math.min(99, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) } as Timing)}
            className="h-7 w-8 rounded-check bg-zebra-950/5 text-center type-label text-zebra-950"
          />
          <Dropdown
            label="Unit"
            inline
            options={t.mode === 'after' ? UNITS : UNITS.slice(2)}
            value={t.unit}
            onChange={(unit) => onChange({ ...t, unit } as Timing)}
          />
        </>
      )}
      <Dropdown label="When" inline options={t.mode === 'now' ? MODES_NOW : MODES} value={t.mode} onChange={setMode} />
    </PropRow>
  );
}
