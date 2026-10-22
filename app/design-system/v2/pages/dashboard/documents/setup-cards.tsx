
import { HOVER_ON_WHITE } from '@/components/ui-v2/control-styles';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { ArrowRightIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import type { KindInfo } from './kinds';

/**
 * The top of the Documents page while a kind of document the journey
 * sends has no template yet: a card per missing kind (what it is for,
 * the journey step waiting on it, Set up), under "Finish your journey"
 * and how many of the kinds are ready. Pulled up top so what is missing
 * is the first thing the MC sees, rather than a greyed row lost between
 * lists (2026-10-09 founder mockup). Gone once every kind has one.
 *
 * Cards are glass panels with no border, per the v2 rule against boxed
 * outlines; the whole card is the Set up button.
 *
 * @module app/design-system/v2/pages/dashboard/documents/setup-cards
 */

/** One kind still to set up. */
export interface SetupCard {
  kind: KindInfo;
  /** What it is for: "Couples sign online once they accept". */
  use: string;
  /** The journey step waiting on it, counted from 1, or null when the journey does not send it. */
  step: number | null;
  onSetUp: () => void;
}

export interface SetupCardsProps {
  cards: SetupCard[];
  /** How many of the journey's kinds have a template. */
  ready: number;
  /** How many kinds the journey can send. */
  total: number;
}

/** The setup cards. See {@link SetupCardsProps}. */
export function SetupCards({ cards, ready, total }: SetupCardsProps) {
  // Only "your journey" when the journey actually waits on one of them.
  const title = cards.some((c) => c.step !== null) ? 'Finish your journey' : 'Still to set up';
  return (
    <section aria-labelledby="documents-setup">
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 id="documents-setup" className="type-label text-zebra-950">
          {title}
        </h2>
        <div className="flex items-center gap-3 type-body text-zebra-500">
          {ready} of {total} ready
          <span aria-hidden="true" className="hidden gap-1 sm:flex">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1 w-5 rounded-pill ${i < ready ? 'bg-grass-500' : 'bg-zebra-200'}`}
              />
            ))}
          </span>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ kind, use, step, onSetUp }) => {
          return (
            // The first-run guide points at a kind's first row: `new-contract`, `new-questionnaire`, …
            <li
              key={kind.id}
              id={`kind-${kind.id}`}
              data-tour={`new-${kind.one.toLowerCase()}`}
              className="relative"
            >
              <Panel className={`flex h-full flex-col gap-4 p-5 transition-colors duration-150 motion-reduce:transition-none ${HOVER_ON_WHITE}`}>
                <div className="flex items-start justify-between gap-3">
                  <IconCircle icon={kind.icon} />
                  {step !== null ? (
                    <span className="type-body text-zebra-400">Step {step}</span>
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="type-label text-zebra-950">{kind.one}</p>
                  <p className="type-body text-zebra-500">{use}.</p>
                </div>
                <StretchedButton
                  label={`Set up ${/^[aeiou]/i.test(kind.one) ? 'an' : 'a'} ${kind.one.toLowerCase()}`}
                  radius="panel"
                  onClick={onSetUp}
                >
                  <span className="inline-flex items-center gap-1.5 type-label text-zebra-950">
                    Set up
                    <ArrowRightIcon aria-hidden="true" className="size-4" />
                  </span>
                </StretchedButton>
              </Panel>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
