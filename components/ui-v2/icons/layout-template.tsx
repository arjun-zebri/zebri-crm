import { createIcon } from './icon-base';

/**
 * Layout template glyph: a wide panel over a broad block and a narrow one. For a page layout or template.
 *
 * @example
 * ```tsx
 * <LayoutTemplateIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/layout-template
 */
export const LayoutTemplateIcon = createIcon(
  'LayoutTemplateIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="10" height="7" rx="2" />
    <rect x="16.5" y="13.5" width="4" height="7" rx="2" />
  </>,
);
