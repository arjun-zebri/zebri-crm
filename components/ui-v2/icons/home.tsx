import { createIcon } from './icon-base';

/**
 * Home glyph: an arched silhouette, soft like a doorway, with an arched
 * door inside. For the Home page and anything that returns to it.
 *
 * @example
 * ```tsx
 * <HomeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/home
 */
export const HomeIcon = createIcon(
  'HomeIcon',
  'glyph',
  <>
    <path d="M4.5 21.5V12a7.5 7.5 0 0 1 15 0v9.5z" />
    <path d="M10 21.5V18a2 2 0 0 1 4 0v3.5" />
  </>,
);
