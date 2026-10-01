import type { HTMLAttributes, Ref } from 'react';

/**
 * Design system v2 panel (preview, shown on `/design-system/v2`).
 *
 * The one container surface in v2: a white glass pane with a heavy blur
 * (`surface-glass` in `app/globals.css`) that lets the {@link Backdrop}'s
 * wash shine through. Use it for every card and toolbar, so every raised
 * thing in the app is the same material. `tone="highlight"`
 * is for the one block inside a panel that matters most: pure white
 * with a grass-to-sky hairline (`surface-highlight`). `raised` adds the
 * modal shadow for a panel that floats alone over the backdrop.
 *
 * Not used by the app yet; v1's `Card` is still the one to build with.
 *
 * @example
 * ```tsx
 * <Panel className="p-8">
 *   <Panel tone="highlight" className="p-6">$44.25</Panel>
 * </Panel>
 * <Panel as="section" aria-labelledby="plan-title">…</Panel>
 * ```
 *
 * @module components/ui-v2/panel
 */

/** Surface treatment. */
export type PanelTone = 'glass' | 'highlight';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /**
   * `'glass'` (default) for containers; `'highlight'` for the key block
   * inside a panel.
   */
  tone?: PanelTone;
  /**
   * Lift the panel off the backdrop with the modal shadow and a hairline
   * ring. For a panel that is the whole screen's subject (a dialog, the
   * onboarding card); flat panels in a page leave it off.
   */
  raised?: boolean | undefined;
  /** Element to render. Defaults to `'div'`. */
  as?: 'div' | 'section' | 'aside' | 'header';
  /** Optional ref to the rendered element. */
  ref?: Ref<HTMLElement & HTMLDivElement>;
}

// A highlight nests inside a glass panel, so its corners are a step
// tighter (the 6px button radius) to stay concentric with the outer 10px.
// Each tone sets its own text colour: two text colours on one element
// resolve by CSS order, not class order.
const TONES: Record<PanelTone, string> = {
  glass: 'surface-glass rounded-panel text-zebra-950',
  highlight: 'surface-highlight rounded-button text-zebra-950',
};

/** v2 panel. See {@link PanelProps}. Padding is left to the caller. */
export function Panel({ as: Tag = 'div', tone = 'glass', raised = false, className, ref, ...rest }: PanelProps) {
  return (
    <Tag
      ref={ref}
      className={`${TONES[tone]}${raised ? ' shadow-xl ring-1 ring-zebra-950/5' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
}
