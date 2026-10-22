import { createIcon } from './icon-base';

/**
 * Collapse glyph: two chevrons pointing in to the middle. For collapsing
 * expanded rows or sections.
 *
 * @example
 * ```tsx
 * <CollapseIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/collapse
 */
export const CollapseIcon = createIcon(
  'CollapseIcon',
  'glyph',
  <>
    <path d="M7.5 4l4.5 4.5L16.5 4M7.5 20l4.5-4.5 4.5 4.5" />
  </>,
);
