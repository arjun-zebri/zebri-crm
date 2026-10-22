import type { ReactNode } from 'react';

import { FocusModality } from './focus-modality';

/**
 * Layout for the v2 preview pages: adds focus-modality tracking so
 * the focus mark shows for keyboard users only, never on a click.
 *
 * @module app/design-system/v2/layout
 */

/** Wraps every /design-system/v2 page. */
export default function DesignSystemV2Layout({ children }: { children: ReactNode }) {
  return (
    // `v2-scroll` (app/globals.css) gives every scroll area in v2 the quiet
    // scrollbar; `contents` keeps this wrapper out of the layout.
    <div className="v2-scroll contents">
      <FocusModality />
      {children}
    </div>
  );
}
