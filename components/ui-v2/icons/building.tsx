import { createIcon } from './icon-base';

/**
 * Building glyph: a soft tower with a lower wing, windows as dots and a small door. For a company or organisation.
 *
 * @example
 * ```tsx
 * <BuildingIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/building
 */
export const BuildingIcon = createIcon(
  'BuildingIcon',
  'glyph',
  <>
    <path d="M4 21V7a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v14" />
    <path d="M15 10.5h1.5a3.5 3.5 0 0 1 3.5 3.5v7" />
    <path d="M2.5 21h19" />
    <path d="M8 7.5h0M11 7.5h0M8 11h0M11 11h0M8 14.5h0M11 14.5h0M17.5 14.5h0" />
    <path d="M8.5 21v-1.5a1 1 0 0 1 2 0V21" />
  </>,
);
