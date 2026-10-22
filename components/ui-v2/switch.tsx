'use client';

import { useEffect, useRef } from 'react';

import { CheckIcon } from '@/components/ui-v2/icons';

/**
 * Design system v2 switch (preview): an on/off setting that takes effect
 * at once (a booking type live or paused), where a checkbox would read
 * as part of a form still to be submitted. On is the `selected` green
 * (grass-800), as a checked {@link Checkbox}.
 *
 * 44 by 24, a raised white thumb on a slightly sunk track. The thumb
 * glides on the slow-settling `--ease-glide` curve (400ms) and squashes
 * in flight (shorter, a touch wider), springing back to full size as it
 * lands. When on, the house tick (Lucide `Check` at 1.5) fades into the
 * thumb as it arrives; when off, it goes at once, ahead of the slide. No
 * motion on first render; none at all under reduced motion.
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

/** Thumb `scale` over the slide: squash early, settle back by landing. */
const SQUASH = ['1 1', '1.14 0.78', '1 1'];
const SLIDE_MS = 400;

/** v2 switch. See {@link SwitchProps}. */
export function Switch({ checked, onChange, disabled, ...aria }: SwitchProps) {
  const thumb = useRef<HTMLSpanElement>(null);
  const mounted = useRef(false);

  // The squash runs on the `scale` property via Web Animations, which
  // composes with the Tailwind `translate` utility rather than fighting
  // it for `transform`. It follows `checked`, so a change from outside
  // (a row toggled elsewhere) squashes too, but the first render does not.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    thumb.current?.animate(
      SQUASH.map((scale) => ({ scale })),
      { duration: SLIDE_MS, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    );
  }, [checked]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 shadow-switch-track transition-colors duration-[400ms] ease-glide focus-mark disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none ${
        checked ? 'bg-selected hover:bg-grass-900' : 'bg-zebra-300 hover:bg-zebra-400'
      }`}
      {...aria}
    >
      <span
        ref={thumb}
        aria-hidden="true"
        className={`grid size-5 place-items-center rounded-pill bg-field shadow-switch-thumb transition-[translate] duration-[400ms] ease-glide motion-reduce:transition-none ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      >
        {/* A transition, not a keyframe: it reverses mid-way if toggled
            fast, and stays still on first render. On, it waits for the
            thumb to near the end, then fades in; off, it goes at once. */}
        <CheckIcon
          className={`size-3.5 text-selected transition-[opacity,scale] motion-reduce:transition-none ${
            checked ? 'scale-100 opacity-100 delay-150 duration-150 ease-glide' : 'scale-75 opacity-0 duration-150 ease-in'
          }`}
        />
      </span>
    </button>
  );
}
