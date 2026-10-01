/**
 * Shared class strings for v2 text controls (Input, Textarea), so every
 * field has the same border, focus glow and error state; and for the
 * floating surfaces (Dropdown's menu, Popover), so every menu matches.
 *
 * Focus is the border turning grass green plus a soft 3px grass halo,
 * the same green as the primary button. The
 * halo is a spread box-shadow, not a `ring`, because a shadow follows
 * the border radius exactly, while v1 found a ring's corners do not
 * nest cleanly inside the border.
 *
 * @module components/ui-v2/control-styles
 */

/** Base look for every v2 text control. */
export const CONTROL =
  'block w-full rounded-panel border bg-field px-3 type-body text-zebra-950 ' +
  'placeholder:text-zebra-400 transition-[border-color,box-shadow] duration-150 ease-out ' +
  'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ' +
  'motion-reduce:transition-none';

/** Resting and focused state. */
export const CONTROL_OK =
  'border-zebra-200 hover:border-zebra-300 ' +
  'focus-visible:border-grass-600 focus-visible:shadow-[0_0_0_3px_var(--color-grass-100)]';

/** Error state: red border, red halo on focus. */
export const CONTROL_ERROR =
  'border-danger focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-danger)_18%,transparent)]';

/** The full class string for a control, given whether it is in error. */
export function controlClass(invalid: boolean): string {
  return `${CONTROL} ${invalid ? CONTROL_ERROR : CONTROL_OK}`;
}

/**
 * The floating surface every v2 menu and popover shares: white, a
 * zebra-200 hairline, the floating shadow, fading in over 120ms. Corner
 * radius and padding come from the size (see `Popover`).
 */
export const FLOATING =
  'z-[70] border border-zebra-200 bg-field shadow-lg outline-none ' +
  'motion-safe:animate-[fade-in_120ms_ease-out_both]';

/**
 * A menu list's surface: 6px corners like the control that opened it,
 * 4px inset so the highlighted row keeps a gutter.
 */
export const MENU_SURFACE = `${FLOATING} rounded-button p-1`;

/**
 * One row of a menu list (Dropdown options, Popover `MenuOption`): 32px,
 * body text, zebra-100 behind the highlighted or focused row.
 */
export const MENU_ITEM =
  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-check px-2 text-left type-body text-zebra-700 ' +
  'outline-none select-none hover:bg-zebra-100 hover:text-zebra-950 focus-visible:bg-zebra-100 ' +
  'data-[highlighted]:bg-zebra-100 data-[highlighted]:text-zebra-950';
