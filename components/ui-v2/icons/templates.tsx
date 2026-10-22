import { createIcon } from './icon-base';

/**
 * Templates glyph: two soft pages, one behind the other, the front one
 * with a title line. The page you keep and copy from. For the Templates
 * view on the Documents page.
 *
 * @example
 * ```tsx
 * <TemplatesIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/templates
 */
export const TemplatesIcon = createIcon(
  'TemplatesIcon',
  'glyph',
  <>
    <rect x="3.5" y="6" width="13.5" height="15.5" rx="4" />
    <path d="M7.5 2.5h9a4 4 0 0 1 4 4v11" />
    <path d="M7.5 10.5h6" />
  </>,
);
