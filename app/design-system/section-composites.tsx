import { CompositesBound } from './composites-bound';
import { CompositesMisc } from './composites-misc';
import { CompositesQuestionnaires } from './composites-questionnaires';
import { Section } from './showroom';

/**
 * Feature composites: everything in `components/<feature>/`.
 *
 * Split by how each one can be rendered. Prop-driven composites are
 * fully interactive; Supabase-bound ones run against a seeded query
 * cache with interaction disabled.
 *
 * @module app/design-system/section-composites
 */
export function SectionComposites() {
  return (
    <Section
      id="composites"
      title="Feature composites"
      description="The 21 components in components/auth, builders, events, questionnaires, settings and time-tracking. Prop-driven ones are live; Supabase-bound ones render from a seeded cache with interaction disabled, because the dev server writes to the remote database."
    >
      <CompositesMisc />
      <CompositesQuestionnaires />
      <CompositesBound />
    </Section>
  );
}
