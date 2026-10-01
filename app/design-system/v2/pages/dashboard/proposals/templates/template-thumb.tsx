import { ProposalPreview, sampleOf } from '../proposal-preview';
import type { Template } from '../templates-data';

/**
 * A template's cover in miniature: the real preview drawn at a fixed
 * 40rem width and scaled down to fit, cropped to its top (the cover and
 * the start of the welcome), so the card shows the actual page rather
 * than a drawing of one. The scale is per size, so the smaller pick
 * still shows the couple's names on the cover. Decorative and inert:
 * the card around it is the control, and its name says what it is.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/templates/template-thumb
 */

/** `card` for the Templates tab, `pick` for the smaller choices in New proposal. */
const SIZE = {
  card: 'h-52 [--s:0.42] [--t:1rem]',
  pick: 'h-32 [--s:0.3] [--t:0.5rem]',
} as const;

/** The shrunk cover. */
export function TemplateThumb({ template, size = 'card' }: { template: Template; size?: keyof typeof SIZE }) {
  return (
    <div aria-hidden="true" inert className={`relative w-full overflow-hidden bg-zebra-50 ${SIZE[size]}`}>
      {/* Scaled about its top centre, then pulled back by half its own width, so it sits centred whatever the card's width. */}
      <div className="absolute left-1/2 top-[var(--t)] w-[40rem] origin-top -translate-x-1/2 scale-[var(--s)]">
        <ProposalPreview template={template} wedding={sampleOf(template)} />
      </div>
    </div>
  );
}
