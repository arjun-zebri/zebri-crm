import { PatternsChrome } from './patterns-chrome';
import { PatternsData } from './patterns-data';
import { Section } from './showroom';

/**
 * Page-patterns section.
 *
 * These recur on every page but exist only as copy-pasted markup, so
 * they have drifted further than the primitives. Each specimen is
 * reproduced from real page source.
 *
 * @module app/design-system/section-patterns
 */
export function SectionPatterns() {
  return (
    <Section
      id="patterns"
      title="Page patterns"
      description="Recurring layouts that are not components yet. Every specimen below is copied from real page source, which is why several of them use raw palette colours: that is what the app actually renders."
    >
      <PatternsChrome />
      <PatternsData />
    </Section>
  );
}
