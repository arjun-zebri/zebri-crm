'use client';

import { readAmount, ValueMenu } from '@/components/ui-v2/value-menu';

import type { JourneyStep } from './journeys-data';
import { StepChoice } from './step-choice';
import { StepRow } from './step-row';
import {
  AMOUNTS, DUE_BACKS, DUE_INS, EXPIRIES, PAYS, SIGNERS,
  amountLabel, amountOf, amountsFor, dueBackLabel, dueBackOf, dueInLabel, dueInOf, expiresOf, expiryLabel, payOf, signersOf,
  type Amount, type Pay, type Signers,
} from './step-settings';

/**
 * The settings only one kind of step has, under its timing: when a
 * proposal expires; who signs a contract; what an invoice asks for
 * (a deposit's usual shares, the full fee, or the MC's own percent), when
 * it is due and how they can pay; when a questionnaire is due back; and
 * whether a run sheet goes on to the suppliers. Sending an invoice with
 * the contract and charging the card they paid with before were cut
 * (founder, 2026-10-08): neither was a choice an MC was asking for.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-kind-rows
 */

export interface StepKindRowsProps {
  step: JourneyStep;
  onChange: (step: JourneyStep) => void;
}

/** What an invoice asks for, as the menu holds it: a set choice, or the MC's own percent. */
type Ask = { amount: Amount; pct?: number | undefined };
/** A typed percent that is a set share is that share ("25" is 25% of the package; "100" the full fee). */
const SHARE: Partial<Record<number, Exclude<Amount, 'custom'>>> = { 20: 'p20', 25: 'p25', 30: 'p30', 100: 'full' };
const askLabel = (a: Ask) => (a.amount === 'custom' ? `${a.pct ?? 25}% of the package` : AMOUNTS[a.amount]);

/**
 * What an invoice asks for: the v2 `ValueMenu` (type to find,
 * 2026-10-15): the set shares, or type any percent.
 */
function AmountChoice({ step, onChange }: { step: JourneyStep; onChange: (step: JourneyStep) => void }) {
  const value: Ask = { amount: amountOf(step), pct: step.amountPct };
  return (
    <StepChoice label="Asks for" value={amountLabel(step)} labelOf={(v) => v}>
      {(close) => (
        <ValueMenu
          label="Asks for"
          value={value}
          presets={amountsFor(step).map((amount) => ({ amount }))}
          show={askLabel}
          read={(t) => readAmount(t, ['%'] as const, { '%': 100 }).map(({ n }): Ask => ({ amount: SHARE[n] ?? 'custom', pct: n }))}
          placeholder="Type a percent…"
          onPick={(a) => {
            close();
            onChange({ ...step, amount: a.amount, amountPct: a.amount === 'custom' ? a.pct : step.amountPct });
          }}
        />
      )}
    </StepChoice>
  );
}

/** The rows for `step`'s kind; nothing for a kind with none. See {@link StepKindRowsProps}. */
export function StepKindRows({ step, onChange }: StepKindRowsProps) {
  const set = (patch: Partial<JourneyStep>) => onChange({ ...step, ...patch });
  switch (step.kind) {
    case 'proposal':
      return (
        <StepRow label="Expires">
          <StepChoice label="Expires" value={expiresOf(step)} options={EXPIRIES} labelOf={expiryLabel} onChange={(d) => set({ expires: d })} />
        </StepRow>
      );
    case 'contract':
      return (
        <StepRow label="Who signs">
          <StepChoice label="Who signs" value={signersOf(step)} options={Object.keys(SIGNERS) as Signers[]} labelOf={(k) => SIGNERS[k]} onChange={(k) => set({ signers: k })} />
        </StepRow>
      );
    case 'invoice':
      return (
        <>
          <StepRow label="Asks for">
            <AmountChoice step={step} onChange={onChange} />
          </StepRow>
          <StepRow label="Due">
            <StepChoice label="Due" value={dueInOf(step)} options={DUE_INS} labelOf={dueInLabel} onChange={(d) => set({ dueIn: d })} />
          </StepRow>
          <StepRow label="They can pay by">
            <StepChoice label="They can pay by" value={payOf(step)} options={Object.keys(PAYS) as Pay[]} labelOf={(k) => PAYS[k]} onChange={(k) => set({ pay: k })} />
          </StepRow>
        </>
      );
    case 'questionnaire':
      return (
        <StepRow label="Due back">
          <StepChoice label="Due back" value={dueBackOf(step)} options={DUE_BACKS} labelOf={dueBackLabel} onChange={(w) => set({ dueBack: w })} />
        </StepRow>
      );
    case 'runSheet':
      return (
        <StepRow label="Goes to">
          <StepChoice
            label="Goes to"
            value={step.suppliers ? 'all' : 'couple'}
            options={['couple', 'all'] as const}
            labelOf={(k) => (k === 'all' ? 'The couple, then their suppliers' : 'Just the couple')}
            onChange={(k) => set({ suppliers: k === 'all' })}
          />
        </StepRow>
      );
    default:
      return null;
  }
}
