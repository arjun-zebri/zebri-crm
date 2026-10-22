import { createIcon } from './icon-base';

/**
 * Drag glyph: two columns of three heavy dots (small rings, so they hold weight at 14px). For a drag handle.
 *
 * @example
 * ```tsx
 * <DragIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/drag
 */
export const DragIcon = createIcon(
  'DragIcon',
  'glyph',
  <>
    <circle cx="9" cy="6.5" r=".75" />
    <circle cx="15" cy="6.5" r=".75" />
    <circle cx="9" cy="12" r=".75" />
    <circle cx="15" cy="12" r=".75" />
    <circle cx="9" cy="17.5" r=".75" />
    <circle cx="15" cy="17.5" r=".75" />
  </>,
);
