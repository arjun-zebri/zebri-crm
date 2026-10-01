/**
 * Design system v2 switch (preview): an on/off setting that takes effect
 * at once (a booking type live or paused), where a checkbox would read
 * as part of a form still to be submitted. On is the same grass-800 as
 * a checked {@link Checkbox}; the thumb slides, and nothing else moves.
 *
 * A `<button role="switch">`, so it needs a name: pass `aria-label`, or
 * `aria-labelledby` pointing at the text beside it.
 *
 * @example
 * ```tsx
 * <Switch checked={live} onChange={setLive} aria-label="Intro call bookable" />
 * ```
 *
 * @module components/ui-v2/switch
 */

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
}

/** v2 switch. See {@link SwitchProps}. */
export function Switch({ checked, onChange, disabled, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill p-0.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
        checked ? 'bg-grass-800 hover:bg-grass-900' : 'bg-zebra-300 hover:bg-zebra-400'
      }`}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={`size-4 rounded-pill bg-field shadow-sm transition-[translate] duration-150 ease-out motion-reduce:transition-none ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}
