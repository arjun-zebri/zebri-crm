import type { DocLayout, DocSection } from './types';

/**
 * A document kept while the engine had its own Reviews kind, brought back
 * to production's kinds as it opens in the editor: the editor is
 * production's own now (2026-10-10), and it edits reviews as production's
 * testimonials (named "Reviews"). Stars are dropped; production has none.
 * Pages already sent are left as they went out; only an editor upgrades.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/model/upgrade
 */

/** `section` as one of production's kinds. */
function upgradeSection(section: DocSection): DocSection {
  if (section.data?.kind !== 'reviews') return section;
  const { reviews } = section.data;
  return {
    ...section,
    kind: 'testimonials',
    data: {
      kind: 'testimonials',
      testimonials: {
        layout: reviews.layout === 'list' ? 'carousel' : 'cards',
        items: reviews.items.map((r) => ({ id: r.id, quote: r.quote, names: r.name, detail: r.detail ?? '' })),
      },
    },
  };
}

/** `layout` with every engine-only review section upgraded; the same object when nothing changed. */
export function upgradeLayout(layout: DocLayout): DocLayout {
  const sections = layout.sections.map(upgradeSection);
  return sections.every((s, i) => s === layout.sections[i]) ? layout : { ...layout, sections };
}
