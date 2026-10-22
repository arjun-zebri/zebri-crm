'use client';

import { useEffect, useState } from 'react';

import { SearchIcon } from '@/components/ui-v2/icons';

import { SLIP } from './bdm-snap-form';
import { EASE, Row, Rows, STACK, Status, useBeats, type SnapProps } from './bdm-snap-parts';

/**
 * Step 2 of the BDM lodgement band: Zebri checking the couple's answers
 * against BDM's own rules (`dashboard/bdm/rules.ts`), shown on the one
 * answer step 1 typed, in the same rows step 1 used, so the band reads as
 * one notice moving through (founder, 2026-10-19). The status counts the
 * answers as it checks them, turns amber at one to fix, with the rule's
 * own words under the answer in red, and green once it is fixed in place:
 * "Amelia" stays and "Rose" moves to an Other given names row under it.
 * Before and after share one cell and cross-fade, so the card never
 * changes height.
 *
 * @module app/design-system/v2/pages/website/bdm-snap-check
 */

const TOTAL = 47;
const COUNT_MS = 1400;
/** The checks finish with one refused, then the fix lands; ms from the card's start. */
const BEATS = [400 + COUNT_MS, 4300];
/** How long the play runs, for the band's pacing: the fix, and a beat to read it. */
export const CHECK_MS = 5800;

const [FIRST = '', ...REST] = SLIP.split(' ');
const OTHERS = REST.join(' ');
/** The rule's own words (`rules.ts`), so the site never paraphrases what BDM refuses. */
const RULE = 'One word only; the rest belongs in Other given names';

/** Counts up to `to` over `ms` once `on`, after a short breath, easing out. */
function useCount(on: boolean, to: number, ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    let id = 0;
    const wait = window.setTimeout(() => {
      const started = performance.now();
      id = window.setInterval(() => {
        const t = Math.min(1, (performance.now() - started) / ms);
        setN(Math.round(to * (1 - (1 - t) ** 3)));
        if (t >= 1) window.clearInterval(id);
      }, 30);
    }, 400);
    return () => (window.clearTimeout(wait), window.clearInterval(id));
  }, [on, to, ms]);
  return n;
}

/** The checks, on the slip. See {@link SnapProps}. */
export function CheckSnap({ playing, done }: SnapProps) {
  const played = useBeats(playing, BEATS);
  const beat = done ? BEATS.length : playing ? played : 0;
  const refused = beat === 1;
  const fixed = beat >= 2;
  const counted = useCount(playing, TOTAL - 1, COUNT_MS);
  const status = fixed
    ? { state: 'done' as const, title: `All ${TOTAL} answers pass`, detail: 'Against BDM’s own rules' }
    : refused
      ? { state: 'warn' as const, title: '1 answer to fix', detail: `${TOTAL - 1} of ${TOTAL} pass BDM’s rules` }
      : { state: playing ? ('busy' as const) : ('idle' as const), title: `Checking ${TOTAL} answers`, detail: `${counted} of ${TOTAL} pass BDM’s rules` };
  return (
    <div>
      <Status icon={SearchIcon} {...status} />
      <Rows>
        {/* Before and after the fix, layered in one cell so the card keeps one height and
            only cross-fades (founder, 2026-10-19: a card that grows pushes the page about,
            worst on a phone, where the cards stack). */}
        <div className="grid">
          <div className={`${STACK} ${EASE} ${fixed ? 'opacity-0' : 'opacity-100'}`}>
            {/* Empty until its turn: the answer arrives from step 1, never before it is typed there. */}
            <Row label="First given name" value={playing || done ? SLIP : ''}>
              <p className={`pt-1 text-pretty type-body text-danger ${EASE} ${refused ? 'opacity-100' : 'opacity-0'}`}>{RULE}</p>
            </Row>
          </div>
          <div className={`${STACK} ${EASE} ${fixed ? 'opacity-100' : 'opacity-0'}`}>
            <Row label="First given name" value={FIRST} />
            <Row label="Other given names" value={OTHERS} />
          </div>
        </div>
        <Row label="Family name" value="Hart" />
        <Row label="Date of birth" value="12/05/1994" />
      </Rows>
    </div>
  );
}
