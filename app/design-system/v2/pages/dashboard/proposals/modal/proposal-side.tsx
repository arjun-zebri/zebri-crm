import { MirrorChart } from '@/components/ui-v2/mirror-chart';

import { shortDate } from '../../payments/dates';
import { History } from '../../payments/modal/document-facts';
import { money } from '../../payments/payments-data';
import type { Proposal } from '../proposals-data';
import { templateOf } from '../templates-data';

import type { ReadingPosition } from './use-reading-position';

/**
 * The proposal modal's side column, to the user's mockup. First the
 * facts: the template, the value and the expiry (the user cut a status
 * heading and a pipeline stage row from here). Then where their
 * attention went: each partner's time per section as a `MirrorChart`
 * (no headline over it, the user cut it), whose bold row and line
 * follow the preview as it scrolls (`reading`). Then Activity, newest
 * first. Sections are separated by space, no rules or boxes (v2
 * ruling). No Zebri next move or Pause here: on Proposals, Zebri only
 * drafts the nudges.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/modal/proposal-side
 */

/**
 * The chart line's place for a reading position: the start of Welcome
 * (0) maps to the Welcome row's middle and the end of Accept (all rows)
 * to the Accept row's middle, so the line runs from Welcome to Accept
 * and never past either.
 */
const lineAt = (at: number, rows: number) => (rows ? 0.5 + (at * (rows - 1)) / rows : 0);

/** Facts, attention and activity for a proposal. */
export function ProposalSide({ proposal: p, reading }: { proposal: Proposal; reading?: ReadingPosition | null | undefined }) {
  const read = (p.reading ?? []).some(([, a, b]) => a + b > 0);
  const booked = p.group === 'accepted';
  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 type-body">
        <dt className="text-zebra-500">Template</dt>
        <dd className="text-zebra-950">{templateOf(p.template).name}</dd>
        <dt className="text-zebra-500">Value</dt>
        <dd className="tabular-nums text-zebra-950">{money(p.value)}</dd>
        {p.expiresOn && !booked ? (
          <>
            <dt className="text-zebra-500">Expires</dt>
            <dd className="text-zebra-950">
              {shortDate(p.expiresOn)}
              {p.expiresIn !== null ? <span className="text-zebra-500"> · in {p.expiresIn} days</span> : null}
            </dd>
          </>
        ) : null}
      </dl>
      {read ? (
        <section aria-labelledby="proposal-attention" className="space-y-3">
          <h3 id="proposal-attention" className="type-subheading text-zebra-950">
            Where their attention went
          </h3>
          <MirrorChart
            people={p.names}
            rows={(p.reading ?? []).map(([label, a, b]) => ({ label, a, b }))}
            active={reading ? reading.row : undefined}
            marker={reading ? lineAt(reading.at, p.reading?.length ?? 0) : undefined}
          />
        </section>
      ) : null}
      <section aria-labelledby="proposal-activity" className="space-y-3">
        <h3 id="proposal-activity" className="type-subheading text-zebra-950">
          Activity
        </h3>
        <History items={p.history} compact />
      </section>
    </div>
  );
}
