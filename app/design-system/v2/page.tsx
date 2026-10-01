import { ComponentsButtonsV2 } from './components-buttons';
import { ComponentsDataV2 } from './components-data';
import { ComponentsDatesV2 } from './components-dates';
import { ComponentsDialogV2 } from './components-dialog';
import { ComponentsDisplayV2 } from './components-display';
import { ComponentsDocumentsV2 } from './components-documents';
import { ComponentsFormsV2 } from './components-forms';
import { ComponentsMomentsV2 } from './components-moments';
import { ComponentsMotionV2 } from './components-motion';
import { ComponentsPatternsV2 } from './components-patterns';
import { ComponentsSelectionV2 } from './components-selection';
import { DesignSystemNavV2 } from './design-system-nav-v2';
import { FoundationsColourV2 } from './foundations-colour';
import { FoundationsSurfaceV2 } from './foundations-surface';
import { FoundationsTypeV2 } from './foundations-type';
import { PagesAuthV2 } from './pages-auth';
import { Section } from './showroom-v2';

/**
 * The Zebri design system, v2 (in progress).
 *
 * A fresh system built alongside v1 at `/design-system`, themed on
 * zebras, blue sky and green grass. Nothing in the app consumes it yet;
 * v1 remains the source of truth until v2 is complete. Every primitive
 * in `components/ui-v2/` has an entry here, grouped as the rail lists
 * them, and the page itself is set in v2 (see `showroom-v2.tsx`).
 *
 * Dev-only: inherits the production 404 from `../layout.tsx`.
 *
 * @module app/design-system/v2/page
 */
export default function DesignSystemV2Page() {
  return (
    <div className="mx-auto flex max-w-7xl gap-10 bg-field px-6 py-10">
      <DesignSystemNavV2 />
      <main className="min-w-0 flex-1 space-y-20">
        <header className="space-y-2">
          <h1 className="type-display text-zebra-950">Zebri Design System v2</h1>
          <p className="max-w-2xl type-lead text-zebra-500">
            A work in progress. Zebras, blue sky and green grass. Nothing in the app uses this
            yet: build from v1 at /design-system until v2 is complete.
          </p>
        </header>

        <Section id="foundations" title="Foundations" description="The raw values everything else is built from. Swatches and specimens render with their real utility classes.">
          <div id="colour" className="scroll-mt-8">
            <FoundationsColourV2 />
          </div>
          <div id="typography" className="scroll-mt-8">
            <FoundationsTypeV2 />
          </div>
          <div id="surface" className="scroll-mt-8">
            <FoundationsSurfaceV2 />
          </div>
        </Section>

        <Section id="components" title="Components" description="Every primitive in components/ui-v2, live. Use these; never hand-roll a control, menu, popover or dialog.">
          <ComponentsButtonsV2 />
          <ComponentsFormsV2 />
          <ComponentsSelectionV2 />
          <ComponentsDatesV2 />
          <ComponentsDisplayV2 />
          <ComponentsDataV2 />
          <ComponentsDialogV2 />
          <ComponentsMotionV2 />
          <ComponentsMomentsV2 />
          <ComponentsPatternsV2 />
          <ComponentsDocumentsV2 />
        </Section>

        <Section id="pages" title="Pages" description="Whole pages built only from the v2 pieces above. Forms validate and show their loading state; nothing is submitted.">
          <PagesAuthV2 />
        </Section>
      </main>
    </div>
  );
}
