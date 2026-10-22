import { createIcon } from './icon-base';

/**
 * Panel top glyph: a soft square with a band across its top. For a top panel or header area.
 *
 * @example
 * ```tsx
 * <PanelTopIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/panel-top
 */
export const PanelTopIcon = createIcon(
  'PanelTopIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M3.5 9.5h17" />
  </>,
);
