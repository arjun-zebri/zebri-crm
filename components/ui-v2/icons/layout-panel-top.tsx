import { createIcon } from './icon-base';

/**
 * Layout panel top glyph: a wide panel over two small squares. For a layout with a top panel.
 *
 * @example
 * ```tsx
 * <LayoutPanelTopIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/layout-panel-top
 */
export const LayoutPanelTopIcon = createIcon(
  'LayoutPanelTopIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </>,
);
