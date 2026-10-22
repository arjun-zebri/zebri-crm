import { createIcon } from './icon-base';

/**
 * Shapes glyph: a triangle over a soft square and a circle. For adding a shape.
 *
 * @example
 * ```tsx
 * <ShapesIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/shapes
 */
export const ShapesIcon = createIcon(
  'ShapesIcon',
  'glyph',
  <>
    <path d="M12 3l4.5 7.5h-9z" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="2" />
    <circle cx="16.75" cy="16.75" r="3.75" />
  </>,
);
