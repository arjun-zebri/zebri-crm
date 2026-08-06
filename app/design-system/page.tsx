import { SCANNED_FILES } from './conflict';
import { DesignSystemNav } from './design-system-nav';
import { SectionAudit } from './section-audit';
import { SectionComposites } from './section-composites';
import { SectionFoundations } from './section-foundations';
import { SectionPatterns } from './section-patterns';
import { SectionPrimitives } from './section-primitives';

/**
 * The internal component showroom.
 *
 * Renders every design-system surface in the app and flags, inline, the
 * places where two of them disagree. Nothing here is production UI: the
 * route 404s outside development (see `layout.tsx`).
 *
 * Counts shown throughout come from `audit-data.json`. Refresh them with:
 *
 * ```sh
 * node scripts/design-system-audit.mjs
 * ```
 *
 * This page is an orchestrator. Each section lives in its own module.
 *
 * @module app/design-system/page
 */
export default function DesignSystemPage() {
  return (
    <div className="mx-auto flex max-w-7xl gap-10 px-6 py-10">
      <DesignSystemNav />
      <main className="min-w-0 flex-1 space-y-14">
        <header className="space-y-2">
          <h1 className="text-display font-semibold text-text">Zebri Design System</h1>
          <p className="max-w-2xl text-body text-text-muted">
            Every component in the app, rendered from its real source. Amber blocks mark places
            where two things that should agree do not, with live specimens of each variant and the
            usage counts behind them.
          </p>
          <p className="text-caption text-text-subtle">
            Audit covers {SCANNED_FILES} .tsx files across app/ and components/. The showroom&apos;s
            own source is excluded from every count. Development only.
          </p>
        </header>

        <SectionFoundations />
        <SectionPrimitives />
        <SectionPatterns />
        <SectionComposites />
        <SectionAudit />
      </main>
    </div>
  );
}
