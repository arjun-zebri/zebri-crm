import { DesignSystemNav } from './design-system-nav';
import { SectionComposites } from './section-composites';
import { SectionForms } from './section-forms';
import { SectionFoundations } from './section-foundations';
import { SectionPatterns } from './section-patterns';
import { SectionPrimitives } from './section-primitives';

/**
 * The Zebri design system.
 *
 * The reference for building anything in this app. Every token,
 * primitive, form pattern and page pattern is rendered here from its
 * real source, with the code that produced it.
 *
 * Build from this page. If what you need is not here, add it here first
 * and then use it, rather than hand-rolling markup in a feature file.
 *
 * Dev-only: the route 404s in production (see `layout.tsx`).
 *
 * @module app/design-system/page
 */
export default function DesignSystemPage() {
  return (
    <div className="mx-auto flex max-w-7xl gap-10 px-6 py-10">
      <DesignSystemNav />
      <main className="min-w-0 flex-1 space-y-14">
        <header className="space-y-3">
          <h1 className="text-display font-semibold text-text">Zebri Design System</h1>
          <p className="max-w-2xl text-body text-text-muted">
            Every token, component and pattern in the app, rendered from its real source with the
            code that produced it. This is the reference: build from it rather than hand-rolling
            markup.
          </p>
          <div className="max-w-2xl rounded-control border border-border bg-surface-muted p-4">
            <p className="text-body font-medium text-text">The rule</p>
            <p className="mt-1 text-body text-text-muted">
              If a primitive exists for what you are building, use it. If one nearly fits, extend
              it here and then use it. Hand-written markup for something on this page is how the
              app drifts, and it is not accepted in review.
            </p>
          </div>
        </header>

        <SectionFoundations />
        <SectionPrimitives />
        <SectionForms />
        <SectionPatterns />
        <SectionComposites />
      </main>
    </div>
  );
}
