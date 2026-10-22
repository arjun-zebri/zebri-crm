'use client';

import * as RadixPopover from '@radix-ui/react-popover';
import { forwardRef, useCallback, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { CheckIcon } from '@/components/ui-v2/icons';

import { FLOATING, MENU_ITEM } from './control-styles';

/**
 * Design system v2 popover (preview): something that floats next to the
 * control that opened it, in one of three sizes on the same surface as
 * the `Dropdown` menu (`FLOATING`: white, the hairline ring, floating
 * shadow, the house 150ms fade).
 *
 * - `menu`: a short list of picks (`MenuOption` rows), 10px corners like
 *   the button that opened it.
 * - `card`: a 320px card of facts and one action, 10px corners, padded.
 * - `panel`: a 384px scrolling panel that brings its own layout (the
 *   dashboard's calendar, enquiries and notifications), 10px corners.
 *
 * Built on Radix Popover, so focus, Escape, outside click and collision
 * handling come from there. Inside a modal `<dialog>` the page outside is
 * inert, so the content portals into the enclosing dialog, found from
 * where `PopoverContent` is written.
 *
 * @example
 * ```tsx
 * <Popover open={open} onOpenChange={setOpen}>
 *   <PopoverTrigger asChild><Button variant="ghost">{scope}</Button></PopoverTrigger>
 *   <PopoverContent size="menu" align="start" aria-label="Scope">
 *     <MenuOption selected onSelect={pick}>All clients</MenuOption>
 *   </PopoverContent>
 * </Popover>
 * ```
 *
 * @module components/ui-v2/popover
 */

/** Holds the open state. Radix `Popover.Root`. */
export const Popover = RadixPopover.Root;
/** The control that opens it. Use `asChild` with a v2 `Button` or `TextLink`. */
export const PopoverTrigger = RadixPopover.Trigger;
/** Positions the popover against something other than its trigger. */
export const PopoverAnchor = RadixPopover.Anchor;

export type PopoverSize = 'menu' | 'card' | 'panel';

const SIZES: Record<PopoverSize, string> = {
  menu: 'min-w-48 rounded-panel p-1',
  card: 'w-80 rounded-panel p-4',
  panel: 'w-[24rem] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-panel',
};

export interface PopoverContentProps extends ComponentPropsWithoutRef<typeof RadixPopover.Content> {
  size: PopoverSize;
}

/** The floating surface. See the module notes for sizes. */
export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(function PopoverContent(
  { size, className, sideOffset = size === 'menu' ? 4 : 8, collisionPadding = 16, ...props },
  ref,
) {
  // A hidden marker where the content is written (next to its trigger)
  // finds the enclosing dialog; the content itself is portalled away.
  const [dialog, setDialog] = useState<HTMLElement | null>(null);
  const find = useCallback((el: HTMLSpanElement | null) => setDialog(el?.closest('dialog') ?? null), []);
  return (
    <>
      <span ref={find} hidden />
      <RadixPopover.Portal container={dialog ?? undefined}>
        <RadixPopover.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={`${FLOATING} ${SIZES[size]}${className ? ` ${className}` : ''}`}
          {...props}
        />
      </RadixPopover.Portal>
    </>
  );
});

export interface MenuOptionProps {
  selected?: boolean | undefined;
  onSelect: () => void;
  children: ReactNode;
  /** A muted second line saying what the pick does ("Zebri sends them a reminder"). */
  description?: ReactNode;
  /** One of several that can be on at once (a Show menu): announced as a checkbox, not one pick of many. */
  multiple?: boolean | undefined;
}

/**
 * One pick in a `menu` popover: the same 32px row as a `Dropdown`
 * option, with the `selected` green check on the current one. With a
 * `description` the row grows to two lines, the name over a muted line
 * on what it does, so a menu of choices that need a word of explanation
 * never squeezes the words into the 32px row. With `multiple`, each row
 * turns on and off on its own, the check showing which are on.
 */
export function MenuOption({ selected = false, onSelect, children, description, multiple = false }: MenuOptionProps) {
  // The two-line row swaps the fixed height for padding; replacing the class (not adding one) avoids two heights fighting.
  const row = description ? MENU_ITEM.replace('h-8', 'h-auto py-1.5') : MENU_ITEM;
  return (
    <button type="button" role={multiple ? 'menuitemcheckbox' : 'menuitemradio'} aria-checked={selected} onClick={onSelect} className={`${row}${selected ? ' text-zebra-950' : ''}`}>
      {description ? (
        <span className="flex min-w-0 flex-col">
          <span className="text-zebra-950">{children}</span>
          <span className="text-zebra-500">{description}</span>
        </span>
      ) : (
        children
      )}
      {selected ? <CheckIcon aria-hidden="true" className="ml-auto size-4 shrink-0 text-selected" /> : null}
    </button>
  );
}
