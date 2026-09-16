'use client';

/**
 * The public proposal's Choose -> Sign -> Pay -> Done flow, in one dialog.
 * Wraps {@link useAcceptFlow} (the fetches + resume logic) and swaps in the
 * active step's UI behind a progress row that names the current step and
 * its position.
 *
 * @module app/proposal/[token]/_components/accept-stepper
 */
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import { roleDefaults } from '@/lib/branding/type-defaults';
import type { PublicProposal } from '@/lib/proposals/public-types';

import { ProposalSheet } from './proposal-sheet';
import { ChooseStep } from './steps/choose-step';
import { DoneStep } from './steps/done-step';
import { PayStep } from './steps/pay-step';
import { SignStep } from './steps/sign-step';
import { useAcceptFlow, type AcceptStep } from './use-accept-flow';

/** Props for {@link AcceptStepper}: the dialog's open state, the share token, and the selection shared with the page's package cards. */
export interface AcceptStepperProps {
  open: boolean;
  onClose: () => void;
  token: string;
  proposal: PublicProposal;
  selectedOptionId: string | null;
  selectedAddonIds: readonly string[];
  onSelectOption: (id: string) => void;
  onToggleAddon: (id: string) => void;
  onDownloadPdf?: (() => void) | undefined;
}

const STEPS: ReadonlyArray<{ key: AcceptStep; label: string }> = [
  { key: 'choose', label: 'Choose' },
  { key: 'sign', label: 'Sign' },
  { key: 'pay', label: 'Pay' },
  { key: 'done', label: 'Done' },
];

/** See {@link AcceptStepperProps}. */
export function AcceptStepper({
  open,
  onClose,
  token,
  proposal,
  selectedOptionId,
  selectedAddonIds,
  onSelectOption,
  onToggleAddon,
  onDownloadPdf,
}: AcceptStepperProps) {
  const flow = useAcceptFlow({ token, proposal, selectedOptionId, selectedAddonIds, open });
  // A request in flight must run to completion: closing mid-submit could
  // leave the couple unsure whether their choice, signature or payment
  // went through.
  const close = () => {
    if (!flow.busy) onClose();
  };

  const stepIndex = STEPS.findIndex((s) => s.key === flow.step);
  // STEPS always contains the current flow.step, so the fallback only
  // guards the type (noUncheckedIndexedAccess), never a real miss.
  const current = STEPS[stepIndex] ?? STEPS[0]!;
  const captionStyle = resolveTextStyle(undefined, roleDefaults(proposal, 'finePrint'));

  return (
    <ProposalSheet open={open} onClose={close} title="Confirm your booking" branding={proposal} size="lg">
      <div className="flex flex-col items-center gap-1.5">
        <ol className="flex items-center gap-1.5" aria-label="Booking progress">
          {STEPS.map((s, i) => (
            <li key={s.key} aria-current={s.key === flow.step ? 'step' : undefined}>
              {/* The visible caption below already gives sighted users the
                  step name and position; each dot still carries its own
                  sr-only label (now with position too) so a screen reader
                  gets the same information whichever element it lands on. */}
              <span className="sr-only">{`Step ${i + 1} of ${STEPS.length}: ${s.label}`}</span>
              <span
                aria-hidden="true"
                className={`block rounded-full ${i === stepIndex ? 'h-2 w-2' : 'h-1.5 w-1.5'}`}
                style={{ background: i <= stepIndex ? proposal.brand_color : proposal.border_color }}
              />
            </li>
          ))}
        </ol>
        {/* aria-hidden: the dots above already announce this via aria-current
            + their sr-only labels, so this is a purely visual duplicate for
            sighted users who cannot otherwise tell how many steps remain. */}
        <p className="m-0" style={{ ...captionStyle, color: proposal.muted_color }} aria-hidden="true">
          {`Step ${stepIndex + 1} of ${STEPS.length}: ${current.label}`}
        </p>
      </div>
      {flow.step === 'choose' ? (
        <ChooseStep
          proposal={proposal}
          selectedOptionId={selectedOptionId}
          selectedAddonIds={selectedAddonIds}
          onSelectOption={onSelectOption}
          onToggleAddon={onToggleAddon}
          busy={flow.busy}
          error={flow.error}
          onContinue={flow.accept}
        />
      ) : null}
      {flow.step === 'sign' && flow.contract ? (
        <SignStep
          contract={flow.contract}
          branding={proposal}
          coupleName={proposal.couple_name}
          busy={flow.busy}
          error={flow.error}
          onSign={flow.sign}
          onBack={() => flow.goTo('choose')}
        />
      ) : null}
      {flow.step === 'pay' && flow.invoice ? <PayStep proposal={proposal} invoice={flow.invoice} contract={flow.contract} onSkip={flow.skipPayment} /> : null}
      {flow.step === 'done' ? <DoneStep branding={proposal} businessName={proposal.business_name} invoice={flow.invoice} onDownloadPdf={onDownloadPdf} /> : null}
    </ProposalSheet>
  );
}
