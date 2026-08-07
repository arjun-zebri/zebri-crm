import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Button label that swaps to a spinner without changing size.
 *
 * The label keeps its box and fades to `opacity-0`; the spinner is laid
 * over it. The alternative most call sites reached for was swapping the
 * text (`{saving ? 'Saving…' : 'Save'}`) or appending a spinner beside
 * it, both of which resize the control mid-click and shove whatever sits
 * next to it sideways.
 *
 * {@link Button} uses this internally, so pass `loading` there instead.
 * Reach for `BusyLabel` directly only inside a control that cannot be a
 * `Button` — chiefly the public branded surfaces (portal, questionnaire,
 * invoice, contract), whose buttons take their colour, font and radius
 * from the MC's brand kit via inline `style`.
 *
 * `opacity-0` rather than `invisible` so the button keeps its accessible
 * name while it is busy. Pair with `aria-busy` on the button itself.
 *
 * @example
 * ```tsx
 * <button disabled={saving} aria-busy={saving || undefined} style={brand}>
 *   <BusyLabel busy={saving}>Save</BusyLabel>
 * </button>
 * ```
 *
 * @module components/ui/busy-label
 */

export interface BusyLabelProps {
  /** While true: the label fades out and the spinner shows. */
  busy: boolean;
  /** The label. Icons and text are laid out inline with a 1.5 gap. */
  children: ReactNode;
  /** Spinner edge length in px. Defaults to 16. */
  spinnerSize?: number;
}

/** Size-stable busy state for a button label. See {@link BusyLabelProps}. */
export function BusyLabel({ busy, children, spinnerSize = 16 }: BusyLabelProps) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={`inline-flex items-center gap-1.5${busy ? ' opacity-0' : ''}`}>
        {children}
      </span>
      {busy ? (
        <Loader2
          className="absolute animate-spin"
          width={spinnerSize}
          height={spinnerSize}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
