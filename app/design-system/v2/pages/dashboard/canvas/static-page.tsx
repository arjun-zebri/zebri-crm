'use client';

import { useCanvasData } from './canvas-context';
import { ElementView } from './element-view';
import type { CanvasPage } from './model';
import { colorOf, frameCss } from './resolve';

/**
 * One canvas page, read-only, scaled to `scale`: what the client sees,
 * and every preview of a designed document (the brand kit's, a template
 * card's). The same element drawing as the editor, without its handles,
 * so the two can never disagree. Needs a `CanvasDataProvider` above it.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/static-page
 */
export function StaticPage({ page, scale = 1 }: { page: CanvasPage; scale?: number }) {
  const { kit } = useCanvasData();
  return (
    // The page's size and zoom are runtime values, set inline.
    <div style={{ width: page.width * scale, height: page.height * scale }} className="relative shrink-0 overflow-hidden">
      <div style={{ width: page.width, height: page.height, transform: `scale(${scale})`, background: colorOf(page.background, kit) }} className="absolute left-0 top-0 origin-top-left">
        {page.elements.map((el) => (
          <div key={el.id} style={frameCss(el)}>
            <ElementView el={el} />
          </div>
        ))}
      </div>
    </div>
  );
}
