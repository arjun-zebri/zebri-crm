import { Conflict } from './conflict';
import { FoundationsColour } from './foundations-colour';
import { FoundationsShape } from './foundations-shape';
import { Section } from './showroom';

/**
 * Foundations section: the raw tokens every component is built from.
 *
 * Orchestrator only. Colour lives in {@link FoundationsColour}, the
 * shape-related tokens in {@link FoundationsShape}.
 *
 * @module app/design-system/section-foundations
 */
export function SectionFoundations() {
  return (
    <Section
      id="foundations"
      title="Foundations"
      description="Tokens declared in app/globals.css. Every swatch and specimen below renders with its real utility class, so these are live values rather than documentation."
    >
      <FoundationsColour />
      <FoundationsShape />

      <Conflict
        title="The design docs describe things the code does not have"
        recommendation={
          <>
            Update <code>.claude/docs/frontend-design.md</code> to match the code, or restore what
            it promises. Right now a new contributor reading the doc would write{' '}
            <code>dark:</code> variants and import a component that does not exist.
          </>
        }
      >
        <ul className="space-y-2 text-caption text-text-muted">
          <li>
            <span className="font-medium text-text">Radius mismatch.</span>{' '}
            <code>--radius-card</code> is <code>0.75rem</code> (12px) in{' '}
            <code>app/globals.css</code>, but the doc&apos;s radius table lists it as 8px.
          </li>
          <li>
            <span className="font-medium text-text">Missing component.</span> The doc instructs
            you to place <code>&lt;ThemeToggle /&gt;</code> from{' '}
            <code>components/ui/theme-toggle.tsx</code>. That file does not exist.
          </li>
          <li>
            <span className="font-medium text-text">Dark mode.</span> The doc carries a full
            dark-mode token table and activation instructions. The dark theme was removed in Phase 1
            and <code>globals.css</code> now declares <code>color-scheme: light</code> only. Zero
            files use a <code>dark:</code> variant.
          </li>
        </ul>
      </Conflict>
    </Section>
  );
}
