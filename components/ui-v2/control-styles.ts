/**
 * Shared class strings for v2 text controls (Input, Textarea, Select,
 * Dropdown, ColorField), so every field reads the same; and for the
 * floating surfaces (Dropdown's menu, Popover), so every menu matches.
 *
 * Fields have no box (user ruling, 2026-10-03: no borders and no fill,
 * as New client's fields are): the value sits on the page under its
 * label, in line with it, and focus shows only the caret, as
 * `InlineInput` does. An error is the Field's red message under it. A
 * raised field (a toolbar search beside raised buttons) keeps a white
 * fill and its padding, as the buttons beside it have.
 *
 * @module components/ui-v2/control-styles
 */

/** Base look for every v2 text control. */
export const CONTROL =
  'block w-full type-body text-zebra-950 placeholder:text-zebra-400 ' +
  'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

/**
 * A raised field: white, padded and rounded, with the soft lift and
 * hairline edge raised controls wear (it had none, so the toolbar search
 * looked pasted flat on the backdrop; user, 2026-10-16).
 */
const RAISED = 'rounded-panel bg-field px-3 shadow-btn-soft ring-1 ring-hairline';

// The fill lives on each branch, never on CONTROL: with both
// `bg-transparent` and `bg-field` on one element, CSS order picked
// transparent, so the raised search rendered see-through (2026-10-09).
const BOXLESS = 'bg-transparent';

/** A filled field: a soft grey well, for a search heading a dialog's rail. */
const FILLED = 'rounded-button bg-hover px-3';

/**
 * The full class string for a control. `invalid` is kept for callers:
 * the error shows as the Field's message, not on the control. `raised`
 * gives the toolbar look; `filled` the grey well.
 */
export function controlClass(invalid: boolean, raised = false, filled = false): string {
  void invalid;
  return `${CONTROL} ${raised ? RAISED : filled ? FILLED : BOXLESS}`;
}

/**
 * The grey prompt an empty boxless field shows when its caller gave none.
 * With no box, the placeholder is the only thing that says "type here",
 * and under the quiet-name rule (2026-10-14, see `Field`) it is the
 * field's name itself, as New client's lines say "Name", "Email". A
 * question ("Where did you meet?") is too long for that, keeps its label
 * in view, and gets "Your answer".
 */
export function defaultPlaceholder(
  label: string | undefined,
  placeholder: string | undefined,
): string | undefined {
  if (placeholder !== undefined || !label) return placeholder;
  if (/[?.:]\s*$/.test(label) || label.split(/\s+/).length > 4) return 'Your answer';
  return label;
}

/**
 * The floating surface every v2 menu, popover and floating toolbar
 * shares: white, a hairline ring, the floating shadow, fading in over
 * 150ms (the house speed). Corner radius and padding come from the size
 * (see `Popover`); a floating toolbar uses {@link FLOATING_BAR}.
 */
export const FLOATING =
  'z-[70] bg-field shadow-lg ring-1 ring-hairline outline-none ' +
  'motion-safe:animate-[fade-in_150ms_ease-out_both]';

/**
 * A floating toolbar (the doc builder's section, text and bottom bars,
 * the canvas context toolbar, the zoom bar): the menu surface with the
 * panel's corners and a 4px inset. One recipe, so every bar matches.
 */
export const FLOATING_BAR = 'flex items-center gap-0.5 rounded-panel bg-field p-1 shadow-lg ring-1 ring-hairline';

/** The divider between groups in a {@link FLOATING_BAR}. */
export const BAR_RULE = 'mx-1 h-5 w-px shrink-0 bg-hairline';

/**
 * A menu list's surface: 10px corners like the button that opened it
 * (buttons are `rounded-panel`; a 6px menu under a 10px button read as
 * two systems, user 2026-10-15), 4px inset so the highlighted row keeps
 * a gutter.
 */
export const MENU_SURFACE = `${FLOATING} rounded-panel p-1`;

/**
 * One row of a menu list (Dropdown options, Popover `MenuOption`): 32px,
 * 6px corners (concentric inside the menu's 10px less its 4px inset), body text, the hover fill behind the highlighted row. Inside a menu
 * the highlight is the keyboard position, so rows take no focus mark.
 */
export const MENU_ITEM =
  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-button px-2 text-left type-body text-zebra-700 ' +
  'outline-none select-none hover:bg-hover hover:text-zebra-950 focus-visible:bg-hover ' +
  'data-[highlighted]:bg-hover data-[highlighted]:text-zebra-950';

/** A group label inside a menu ("Today", "Arrange"): the spec's group-label style, one padding. */
export const MENU_LABEL = 'px-2 pb-1 pt-2 type-body text-zebra-400 first:pt-1';

/** A rule between groups in a menu. */
export const MENU_RULE = 'my-1 h-px bg-hairline';

/**
 * The one focus mark for anything pressable (2026-10-14): a grass line
 * outside the shape, keyboard only. Defined as `focus-mark` in
 * `app/globals.css`; exported so callers building class strings name it.
 */
export const FOCUS = 'focus-mark';

/**
 * A ledger row (Input, DateField and Dropdown `row`): the field's name on
 * the left, its value beside it, no box; the row tints on hover and while
 * in use. On a phone the name sits over the value instead, so the value
 * keeps the width a couple filling in their form needs (user, 2026-10-15).
 */
export const LEDGER_ROW =
  '-mx-3 grid grid-cols-1 items-start gap-y-0.5 rounded-button px-3 py-2 transition-colors duration-150 hover:bg-hover focus-within:bg-hover motion-reduce:transition-none sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-x-4';

/**
 * The boxed field (Input, DateField and Dropdown `boxed`): 10px corners
 * like every v2 button, white, a hairline edge and a hint of shadow; the
 * edge darkens on hover and focus, with a soft ring. For the entry
 * screens and the couple's public form (user, 2026-10-15), where a
 * stranger fills it in once and a box needs no explaining. 40px, a
 * step taller than the app's 36px controls (user, 2026-10-15): public
 * forms are filled on phones, by thumbs, and read by people of every age.
 */
const BOXED_SHAPE =
  'block h-10 w-full rounded-panel border bg-field px-3 type-body text-zebra-950 shadow-[0_1px_2px_rgb(11_11_10/0.05)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-zebra-400 focus:ring-4 focus:ring-zebra-950/[0.06] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none';

export const BOXED_CONTROL = `${BOXED_SHAPE} border-zebra-200 hover:border-zebra-300 focus:border-zebra-400`;

/**
 * The boxed field, red-edged while it holds an error. Use this rather
 * than appending `border-danger` to {@link BOXED_CONTROL}: two border
 * colours on one element resolve by stylesheet order, not class order,
 * and the neutral edge won, so an invalid field looked valid.
 */
export const boxedControl = (error: boolean) =>
  error ? `${BOXED_SHAPE} border-danger` : BOXED_CONTROL;

/** A boxed field's name, over the box. */
export const BOXED_LABEL = 'type-label text-zebra-900';

/** The one disabled look for every v2 control: half strength, no pointer. */
export const DISABLED = 'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

/**
 * A pressable row (a list row, a card, a notification): the hover fill,
 * the focus mark, the house speed. Every clickable row in v2 uses this.
 */
export const ROW =
  'cursor-pointer transition-colors duration-150 hover:bg-hover focus-mark motion-reduce:transition-none';

/**
 * The hover fill for something solid white (a secondary button, a choice
 * card): the same `hover` tint, laid over the white as an image rather
 * than replacing it, so the glass behind never shows through.
 */
export const HOVER_ON_WHITE = 'hover:bg-[image:linear-gradient(var(--color-hover),var(--color-hover))]';
