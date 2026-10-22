'use client';

import { useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';

import { DISABLED } from './control-styles';
import { TooltipLabel } from './tooltip';

/**
 * Design system v2 segmented control (preview): two to five mutually
 * exclusive options in one 36px track, the picked one raised on a white
 * thumb. For switching a view (Templates / Sent) or a small setting,
 * where a row of chips would read as a form.
 *
 * Buttons with `aria-pressed` inside a labelled group, like ChipGroup,
 * so it needs no roving focus to be accessible; Tab reaches each option.
 * The thumb is one element under the options that slides to the picked
 * one (150ms, the house speed), so a switch reads as one thing moving rather
 * than one option fading out and another in. Until it has measured the
 * options (first paint) the picked option draws its own thumb, so
 * nothing jumps. The track never changes size. Geometry: a 36px track
 * with the panel's corners, as every toolbar control beside a button has;
 * the thumb keeps the smaller button corner, nested inside it. Icons are
 * drawn at stroke 1.5; `iconsOnly` names each option with a Tooltip.
 *
 * @example
 * ```tsx
 * <Segmented label="Preview" options={['Proposal', 'Contract', 'Invoice']} value={doc} onChange={setDoc} />
 * <Segmented label="Source" options={['All', 'Email']} counts={{ All: 4, Email: 1 }} value={src} onChange={setSrc} />
 * <Segmented label="View" options={['sent', 'templates']} labels={{ sent: 'Sent', templates: 'Templates' }} icons={{ sent: SentIcon }} value={v} onChange={setV} />
 * ```
 *
 * @module components/ui-v2/segmented
 */

export interface SegmentedProps<T extends string> {
  /** Names the group for assistive tech; not shown. */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /**
   * A count after each option's label, in a quieter tone (a filter
   * showing how many items each option holds). Options left out show none.
   */
  counts?: Partial<Record<T, number>> | undefined;
  /**
   * What each option shows, when its value is not its label (a view
   * kept by id). Options left out show their value.
   */
  labels?: Partial<Record<T, string>> | undefined;
  /** A glyph before each option's label (a Zebri or Lucide icon). Decorative. */
  icons?: Partial<Record<T, OptionIcon>> | undefined;
  /**
   * Shows only each option's icon, for a choice that reads better seen
   * than named (the brand kit's corner shapes). The label is still read
   * out, and shown on hover.
   */
  iconsOnly?: boolean | undefined;
  /** Greys the control out and stops it being changed. */
  disabled?: boolean | undefined;
}

/** An option's glyph: any Zebri or Lucide icon. */
type OptionIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true'; strokeWidth?: number }>;

/** Where the thumb sits, in px from the track's left edge. */
type Thumb = { left: number; width: number };

/** v2 segmented control. See {@link SegmentedProps}. */
export function Segmented<T extends string>({ label, options, value, onChange, counts, labels, icons, iconsOnly = false, disabled = false }: SegmentedProps<T>) {
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const index = options.indexOf(value);

  // Measured, not computed: options are as wide as their labels and
  // counts, and a count changing (a questionnaire sent) moves the rest.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const button = el.querySelectorAll<HTMLElement>('[data-option]')[index];
      setThumb(button ? { left: button.offsetLeft, width: button.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, options.length]);

  return (
    <div ref={track} role="group" aria-label={label} className={`relative inline-flex h-9 items-center gap-0.5 rounded-panel bg-zebra-100 p-0.5${disabled ? ' pointer-events-none opacity-50' : ''}`}>
      {thumb ? (
        <span
          aria-hidden="true"
          // Measured values go in as variables; Tailwind places and animates.
          className="absolute inset-y-0.5 left-[var(--thumb-x)] w-[var(--thumb-w)] rounded-button bg-field shadow-sm transition-[left,width] duration-150 ease-out motion-reduce:transition-none"
          style={{ '--thumb-x': `${thumb.left}px`, '--thumb-w': `${thumb.width}px` } as CSSProperties}
        />
      ) : null}
      {options.map((option) => {
        const on = option === value;
        const Icon: OptionIcon | undefined = icons?.[option];
        return (
          <button
            key={option}
            data-option
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`relative flex h-8 items-center gap-1.5 rounded-button ${iconsOnly ? 'group/tip-in px-4' : 'px-3'} type-label transition-colors duration-150 focus-mark ${DISABLED} motion-reduce:transition-none ${
              on ? `text-zebra-950${thumb ? '' : ' bg-field shadow-sm'}` : 'text-zebra-500 hover:text-zebra-950'
            }`}
          >
            {Icon ? <Icon aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" /> : null}
            {iconsOnly ? <span className="sr-only">{labels?.[option] ?? option}</span> : (labels?.[option] ?? option)}
            {counts?.[option] !== undefined ? <span className="type-numeric text-zebra-400">{counts[option]}</span> : null}
            {iconsOnly ? <TooltipLabel label={labels?.[option] ?? option} /> : null}
          </button>
        );
      })}
    </div>
  );
}
