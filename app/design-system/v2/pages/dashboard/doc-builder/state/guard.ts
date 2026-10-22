import type { LayoutAction } from '@/features/proposals';

import { isEngineKind } from '../model/as-production';
import type { DocLayout, DocSection, EngineData } from '../model/types';

/**
 * What the engine refuses or rewrites before an action reaches
 * production's reducer. A locked section (a contract's signatures) is
 * never deleted or duplicated. Production's `resetStyle` rebuilds the
 * section's default from its kind and throws on a kind it does not know,
 * so for an engine kind it becomes a style patch back to the section's
 * plain defaults. Pure, so it is easy to reason about.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/state/guard
 */

/** Every action the document editor takes: production's, with engine sections and data allowed. */
export type DocAction =
  | Exclude<LayoutAction, { type: 'addSection' } | { type: 'setData' } | { type: 'replaceLayout' }>
  | { type: 'addSection'; at: number; section: DocSection }
  | { type: 'replaceLayout'; layout: DocLayout }
  | { type: 'setData'; id: string; data: NonNullable<DocSection['data']> | EngineData };

/** The plain style an engine section resets to. */
const ENGINE_DEFAULT_STYLE: DocSection['style'] = { height: 'fit' };

/** `action` as production should see it, or null to drop it. */
export function guard(layout: DocLayout, action: DocAction): DocAction | null {
  if (action.type === 'deleteSection' || action.type === 'duplicateSection') {
    const section = layout.sections.find((s) => s.id === action.id);
    return section?.locked ? null : action;
  }
  if (action.type === 'resetStyle') {
    const section = layout.sections.find((s) => s.id === action.id);
    if (section && isEngineKind(section.kind)) {
      // Every key cleared, so the section inherits the page's spacing and colours again.
      const cleared = Object.fromEntries(Object.keys(section.style).map((k) => [k, undefined]));
      return { type: 'updateStyle', id: action.id, patch: { ...cleared, ...ENGINE_DEFAULT_STYLE } };
    }
  }
  return action;
}
