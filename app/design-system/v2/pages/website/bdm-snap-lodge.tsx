'use client';

import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { BdmIcon } from '@/components/ui-v2/icons';

import { EASE, STACK, Status, useBeats, type SnapProps } from './bdm-snap-parts';

/**
 * Step 3 of the BDM lodgement band: lodging. The band's shared status
 * line on top (opening on step 2's result, every answer passing, turning
 * to Lodging and then green, Registered); under it what this step is,
 * not another list of rows (founder, 2026-10-19: identical rows on all
 * three could not be told apart): first the action, the couple and
 * date, their marriage certificate ticked to order, Lodge with BDM
 * pressing in and spinning; then, in its place, the registration slip,
 * a bordered record of what was lodged, so the band ends on an object.
 * Zebri's own confirmation, never drawn as BDM's certificate.
 *
 * @module app/design-system/v2/pages/website/bdm-snap-lodge
 */

/** The certificate is ordered, pressed, sending, registered; ms from the card's start. */
const BEATS = [700, 1700, 1950, 3500];
/** How long the play runs, for the band's pacing. */
export const LODGE_MS = 4800;

const SLIP_ROWS = [
  ['Couple', 'Amelia & Jack'],
  ['Married', 'Sat 10 Oct 2026'],
  ['Lodged', 'Mon 12 Oct, 9:14am'],
  ['Certificate', 'Ordered'],
] as const;

/** The lodge. See {@link SnapProps}. */
export function LodgeSnap({ playing, done }: SnapProps) {
  const played = useBeats(playing, BEATS);
  const beat = done ? BEATS.length : playing ? played : 0;
  const sending = beat === 3;
  const registered = beat >= 4;
  const status = registered
    ? { state: 'done' as const, title: 'Registered with NSW BDM', detail: 'Certificate ordered' }
    : sending
      ? { state: 'busy' as const, title: 'Lodging with NSW BDM', detail: 'Amelia & Jack' }
      : { state: 'idle' as const, title: 'Ready to lodge', detail: 'All 47 answers pass' };
  return (
    <div>
      <Status icon={BdmIcon} {...status} />
      <div className="mt-4 grid">
        {/* The action: lifts away as the slip rises into its place. */}
        <div className={`${STACK} space-y-4 self-start ${EASE} ${registered ? '-translate-y-1 opacity-0' : 'translate-y-0 opacity-100'}`}>
          <p className="type-body text-zebra-500">Amelia &amp; Jack · Married Sat 10 Oct 2026</p>
          <Checkbox label="Order their marriage certificate" checked={beat >= 1} readOnly tabIndex={-1} />
          {/* Pressed in for a beat, as a real press would, then busy. */}
          <span className={`block transition-transform duration-200 ease-out motion-reduce:transition-none ${beat === 2 ? 'scale-[0.97]' : 'scale-100'}`}>
            <Button loading={sending} tabIndex={-1} className="w-full">
              <span className="whitespace-nowrap">Lodge with BDM</span>
            </Button>
          </span>
        </div>
        {/* The slip: a bordered record with its own head, the one object on the band that is not a form. */}
        <div
          className={`${STACK} self-start rounded-control bg-field px-4 py-3.5 shadow-sm ring-1 ring-zebra-950/15 ${EASE} ${
            registered ? 'translate-y-0 opacity-100 delay-200' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="type-label text-zebra-950">Marriage registration</p>
            <BdmIcon aria-hidden="true" className="size-4 text-zebra-400" />
          </div>
          <dl className="mt-3 space-y-1.5 border-t border-dashed border-zebra-950/15 pt-3 type-body">
            {SLIP_ROWS.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-zebra-500">{k}</dt>
                <dd className="text-zebra-950">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
