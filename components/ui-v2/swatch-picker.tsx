'use client';

import { useId, type CSSProperties } from 'react';

import { CheckIcon } from '@/components/ui-v2/icons';

import { ColorField } from './color-field';
import { DISABLED } from './control-styles';
import { TooltipLabel } from './tooltip';

/**
 * Design system v2 swatch picker (preview): a labelled row of round
 * colour swatches to pick one from, ending in a custom swatch that opens
 * the full colour picker, set at the end of the label row so the
 * swatches keep one line in a narrow panel. For a choice where a curated set is the point
 * (a brand colour that holds white text) but any colour is still allowed.
 *
 * Each swatch is a real button with `aria-pressed` and the colour's name
 * as its label, inside a labelled `role="group"`. The picked swatch gets
 * a check in a colour that reads on it and a ring offset from it, so the
 * state never relies on colour alone. A custom colour that is not in the
 * set shows in the custom swatch. Each swatch is named by a Tooltip on
 * hover or keyboard focus, and takes the focus mark.
 *
 * @example
 * ```tsx
 * <SwatchPicker label="Brand colour" swatches={[{ value: '#2f521f', name: 'Forest' }]} value={c} onChange={setC} />
 * ```
 *
 * @module components/ui-v2/swatch-picker
 */

/** One swatch: its hex and what to call it. */
export interface Swatch {
  value: string;
  name: string;
}

export interface SwatchPickerProps {
  /** Names the group; shown above the row. */
  label: string;
  swatches: readonly Swatch[];
  /** The picked colour, as a hex. */
  value: string;
  onChange: (hex: string) => void;
  /** Greys the row out; nothing can be picked. */
  disabled?: boolean | undefined;
}

/** White or ink, whichever reads on `hex` (a quick luminance cut). */
function onColour(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.6 ? 'text-zebra-950' : 'text-field';
}

/** v2 swatch picker. See {@link SwatchPickerProps}. */
export function SwatchPicker({ label, swatches, value, onChange, disabled = false }: SwatchPickerProps) {
  const id = useId();
  const v = value.toLowerCase();
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p id={id} className="type-label text-zebra-950">
          {label}
        </p>
        <ColorField bare label="Custom colour" value={value} onChange={onChange} disabled={disabled} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {swatches.map((s) => {
          const on = s.value.toLowerCase() === v;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={on}
              aria-label={s.name}
              disabled={disabled}
              onClick={() => onChange(s.value.toLowerCase())}
              // The colour is the MC's data, chosen at runtime: it arrives as a custom property.
              style={{ '--swatch': s.value } as CSSProperties}
              className={`group/tip-in relative flex size-7 items-center justify-center rounded-pill bg-[var(--swatch)] ring-1 ring-hairline transition-shadow duration-150 focus-mark ${DISABLED} motion-reduce:transition-none ${
                on ? 'shadow-[0_0_0_2px_var(--color-field),0_0_0_4px_var(--color-zebra-950)]' : 'hover:shadow-[0_0_0_2px_var(--color-field),0_0_0_4px_var(--color-pressed)]'
              }`}
            >
              {on ? <CheckIcon aria-hidden="true" className={`size-4 ${onColour(s.value)}`} /> : null}
              <TooltipLabel label={s.name} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
