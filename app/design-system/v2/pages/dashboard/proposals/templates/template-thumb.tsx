import { TemplatePage } from '../../doc-builder/doc-types/proposal/template-page';
import type { TemplateChoice } from '../../doc-builder/doc-types/proposal/template-store';
import { sampleOf } from '../proposal-preview';

/**
 * A template's cover in miniature: the real preview drawn at a fixed
 * 40rem width and scaled down to fit, cropped to its top (the cover and
 * the start of the welcome), so the card shows the actual page rather
 * than a drawing of one. The scale is per size, so the smaller pick
 * still shows the couple's names on the cover. It is the template as the
 * MC last edited it, in their brand kit, so the MC's covers are theirs. Decorative and inert:
 * the card around it is the control, and its name says what it is.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/templates/template-thumb
 */

/** `card` for the Templates tab, `pick` for the smaller choices in New proposal. */
const SIZE = {
  card: 'h-56 [--s:0.5] [--t:1.25rem]',
  pick: 'h-32 [--s:0.3] [--t:0.5rem]',
} as const;

/** The shrunk cover. */
export function TemplateThumb({ choice, size = 'card', couple }: { choice: TemplateChoice; size?: keyof typeof SIZE; couple?: string | null | undefined }) {
  return (
    <div aria-hidden="true" inert className={`relative w-full overflow-hidden bg-zebra-50 ${SIZE[size]}`}>
      {/* Scaled about its top centre, then pulled back by half its own width, so it sits centred whatever the card's width. */}
      <div className="absolute left-1/2 top-[var(--t)] w-[40rem] origin-top -translate-x-1/2 scale-[var(--s)]">
        {/* The couple being written for, when there is one: their name on every cover. */}
        <TemplatePage template={choice.key} wedding={couple ? { ...sampleOf(choice.template), couple } : sampleOf(choice.template)} />
      </div>
      {/* The card's crop fades out, so the page never looks sliced through a line; the small pick stops at the names, so it keeps them clear. */}
      {size === 'card' ? <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zebra-50 to-transparent" /> : null}
    </div>
  );
}
