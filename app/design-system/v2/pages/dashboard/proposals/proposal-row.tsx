import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Swap } from '@/components/ui-v2/swap';

import { CoupleAvatars, ROW } from '../payments/invoice-row';
import { coupleName, money } from '../payments/payments-data';

import { dayWord, weddingLine, type Proposal } from './proposals-data';
import { PACKAGES, templateOf, type PackageId } from './templates-data';

/**
 * One proposal row: the couple and their wedding, the package (the one
 * they lean to while deciding, the one they chose once accepted), the
 * value, and when it last moved. A proposal still out ends in Nudge, a
 * secondary button that opens it with Zebri's drafted follow-up; once
 * sent it hands over to a Nudged tick in place. Where Zebri has a read
 * on the couple ("lingered on Premium") it sits under the row, the one
 * line of why. Clicking anywhere else opens the proposal. On phones the
 * parts stack; from `lg` they line up in fixed columns, as on Payments.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/proposal-row
 */

export interface ProposalRowProps {
  proposal: Proposal;
  onOpen: () => void;
  onNudge: () => void;
}

/** What the package column says, or nothing when there is no pick yet. */
function packageWords(p: Proposal) {
  // An offered package of the MC's own names itself, whatever the template holds.
  const name = (id: PackageId) => p.offer?.name ?? PACKAGES[id].name;
  if (p.chosen) return name(p.chosen);
  if (p.leaning && p.group !== 'closed') return `Leaning to ${name(p.leaning)}`;
  return templateOf(p.template).name;
}

/** A proposal row. See {@link ProposalRowProps}. */
export function ProposalRow({ proposal: p, onOpen, onNudge }: ProposalRowProps) {
  const out = p.group === 'opened' || p.group === 'unopened';
  const nudgedToday = p.nudgedOn && dayWord(p.nudgedOn) === 'today';
  return (
    <li>
      <div className={`${ROW} grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(0,1fr)_12rem_6rem_13rem_7rem]`}>
        <div className="flex min-w-0 items-center gap-3">
          <CoupleAvatars names={p.names} />
          <StretchedButton label={`Open proposal for ${coupleName(p.names)}`} onClick={onOpen}>
            <span className="block truncate type-label text-zebra-950">{coupleName(p.names)}</span>
            <span className="block truncate type-body text-zebra-500">{weddingLine(p)}</span>
          </StretchedButton>
        </div>
        <span className="hidden truncate type-body text-zebra-700 lg:block">{packageWords(p)}</span>
        <span className="text-right type-label tabular-nums text-zebra-950">{money(p.value)}</span>
        <span className="col-span-2 truncate pl-[4.25rem] type-body text-zebra-500 lg:col-span-1 lg:pl-0">{p.when}</span>
        {/* Before the action so phones read the why first; last on wide screens, under the columns. */}
        {p.read && out ? <p className="col-span-full pl-[4.25rem] type-body text-zebra-700 lg:order-last">{p.read}</p> : null}
        {out ? (
          <div className="relative z-10 col-span-2 pl-[4.25rem] pt-2 lg:col-span-1 lg:justify-self-end lg:p-0">
            <Swap
              active={nudgedToday ? 'done' : 'nudge'}
              className="justify-items-end"
              states={{
                nudge: (
                  <Button variant="secondary" onClick={onNudge}>
                    Nudge
                  </Button>
                ),
                done: (
                  <Badge size="control" tone="brand">
                    <DrawnCheck className="size-3.5" />
                    Nudged
                  </Badge>
                ),
              }}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}
