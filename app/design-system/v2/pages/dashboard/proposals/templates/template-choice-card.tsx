import { ChoiceCard } from '@/components/ui-v2/choice-card';

import type { TemplateChoice } from '../../doc-builder/doc-types/proposal/template-store';

import { TemplateThumb } from './template-thumb';

/**
 * A template to pick, as a card: its page in miniature over its name.
 * The miniature is the real page, which draws real buttons (Choose this
 * package, Accept), and a button may not sit inside the card's own
 * button (live-found: a hydration error). So the picture lies over the
 * card's top rather than in it, inert, and the card's button holds only
 * the name and the space the picture covers.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/templates/template-choice-card
 */

export interface TemplateChoiceCardProps {
  choice: TemplateChoice;
  selected: boolean;
  onSelect: () => void;
  /** The couple it is for, named on the cover; the sample couple when unset. */
  couple?: string | null | undefined;
}

/** The card. See {@link TemplateChoiceCardProps}. */
export function TemplateChoiceCard({ choice, selected, onSelect, couple }: TemplateChoiceCardProps) {
  return (
    <div className="relative">
      <ChoiceCard selected={selected} onClick={onSelect} className="overflow-hidden p-0">
        {/* The picture's place: it is drawn over this, outside the button. */}
        <span aria-hidden="true" className="block h-32 w-full" />
        <span className="px-4 py-3 type-label">{choice.template.name}</span>
      </ChoiceCard>
      <div className="pointer-events-none absolute inset-x-0.5 top-0.5 overflow-hidden rounded-t-panel">
        <TemplateThumb choice={choice} size="pick" couple={couple} />
      </div>
    </div>
  );
}
