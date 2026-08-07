import { FoundationsColour } from './foundations-colour';
import { FoundationsShape } from './foundations-shape';
import { FoundationsSurface } from './foundations-surface';
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
      description="The tokens everything else is built from. Every swatch renders with its real utility class, so these are live values rather than documentation."
    >
      <FoundationsColour />
      <FoundationsShape />
      <FoundationsSurface />

    </Section>
  );
}
