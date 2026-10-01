import { Check } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Design system v2 choice card (preview): a large selectable card, for
 * picks that need more than a word (a plan, a trigger, a feature).
 *
 * A real button with `aria-pressed`. Selected is a grass border drawn
 * 2px strong (border plus a matching 1px inset shadow, so the card's
 * size never changes). The fill stays white: a tinted card read as
 * too loud next to its neighbours.
 *
 * `check` adds a checkbox-style mark in the top corner, for groups where
 * several cards can be on at once, so a multi-pick reads as one at a
 * glance. It is decoration: the button's `aria-pressed` carries the state.
 *
 * A flex column, not a block: a button centres its content vertically,
 * so cards stretched to equal height in a grid would float short
 * content in the middle. Flex keeps everything top-aligned. Lay content
 * out in a row by wrapping it in your own flex row.
 *
 * @example
 * ```tsx
 * <ChoiceCard selected={plan === 'pro'} onClick={() => setPlan('pro')}>…</ChoiceCard>
 * ```
 *
 * @module components/ui-v2/choice-card
 */

export interface ChoiceCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Whether this card is the current pick. */
  selected: boolean;
  /** Show a check mark in the top corner (for multi-select groups). */
  check?: boolean | undefined;
  /** Card content. Laid out by the caller. */
  children: ReactNode;
}

/** v2 choice card. See {@link ChoiceCardProps}. */
export function ChoiceCard({ selected, check = false, className, children, type = 'button', ...rest }: ChoiceCardProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`flex w-full flex-col rounded-panel border p-4 text-left text-zebra-950 transition-[border-color,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 focus-visible:ring-offset-2 motion-reduce:transition-none ${
        selected
          ? 'border-grass-700 bg-field shadow-[inset_0_0_0_1px_var(--color-grass-700)]'
          : 'border-zebra-200 bg-field hover:border-zebra-300'
      }${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {check ? (
        <span
          aria-hidden="true"
          className={`flex size-5 items-center justify-center rounded-check border transition-colors duration-150 motion-reduce:transition-none ${
            selected ? 'border-grass-800 bg-grass-800 text-zebra-50' : 'border-zebra-300 bg-field'
          }`}
        >
          {selected ? <Check strokeWidth={1.5} className="size-3.5" /> : null}
        </span>
      ) : null}
      {children}
    </button>
  );
}
