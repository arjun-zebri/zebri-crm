import { createIcon } from './icon-base';

/**
 * New page glyph: the foot of one page and the head of the next, a dashed cut between. For starting a fresh page in a document.
 *
 * @example
 * ```tsx
 * <NewPageIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/new-page
 */
export const NewPageIcon = createIcon(
  'NewPageIcon',
  'glyph',
  <>
    <path d="M5 3v3a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 6V3" />
    <path d="M3.5 12h2M9 12h2M13 12h2M18.5 12h2" />
    <path d="M5 21v-3a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 18v3" />
  </>,
);
