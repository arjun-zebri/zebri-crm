'use client';

import type { ReactNode } from 'react';

import { IconCircle } from '@/components/ui-v2/icon-circle';

import { useAccount } from '../account';
import { TemplatePage } from '../doc-builder/doc-types/proposal/template-page';
import { useTemplateChoices } from '../doc-builder/doc-types/proposal/template-store';
import { sampleInvoice, sampleDeposit } from '../documents/invoice-templates';
import { sampleContract } from '../documents/samples';
import { RunSheetPage } from '../home/run-sheet-page';
import { useRunSheet } from '../home/run-sheet-store';
import { ContractPreview } from '../payments/modal/contract-preview';
import { InvoicePreview } from '../payments/modal/invoice-preview';
import type { Signer } from '../payments/payments-data';
import { sampleOf } from '../proposals/proposal-preview';
import { ClientView } from '../questionnaires/client-view/client-view';
import { useTemplates } from '../questionnaires/questionnaire-store';

import { STEP_ICON, type JourneyStep } from './journeys-data';
import { SAMPLE_MOMENTS, SAMPLE_QUESTIONNAIRE } from './step-samples';
import { signersOf } from './step-settings';

/**
 * What a step sends, as the client sees it: the MC's real proposal
 * cover, contract, invoice, questionnaire or run sheet, drawn with the
 * sample couple (emails have their own, `InboxPreview`). Before the MC has a questionnaire, or
 * moments on a run sheet, the sample ones show (`step-samples.ts`), so
 * the page is never blank. `peek` is the whole page at 85%, for
 * the step dialog's canvas, where it scrolls; `full` is the page at
 * full size, for the full-size preview. A contract or invoice is already
 * a `DocumentPage` (the A4 sheet), so it is shown as it is, never in a
 * second frame; a web page (the proposal, a questionnaire, a run sheet)
 * sits on one plain sheet.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-preview
 */

/** The sample couple, then the MC, as a contract step's Who signs puts them: nobody has signed yet. */
function signersFor(step: JourneyStep, mc: string): Signer[] {
  const who = signersOf(step);
  const client = (name: string): Signer => ({ name, role: 'Client', signed: null });
  return [
    client('Sarah'),
    ...(who === 'both' || who === 'both-you' ? [client('Tom')] : []),
    ...(who.endsWith('you') ? [{ name: mc, role: 'You' as const, signed: null }] : []),
  ];
}

/** How the page is shown. */
export type PreviewFit = 'peek' | 'full';

/** Contract and invoice previews draw their own `DocumentPage`. */
const PAPER = new Set<JourneyStep['kind']>(['contract', 'invoice']);

/** The page itself, full size (794px wide), or null when there is nothing to draw. Emails have their own preview (`InboxPreview`). */
export function usePage(step: JourneyStep): ReactNode {
  const account = useAccount();
  const choice = useTemplateChoices()[0];
  const questionnaire = useTemplates()[0];
  const sheet = useRunSheet('Sarah & Tom');
  switch (step.kind) {
    case 'proposal':
      return choice ? <TemplatePage template={choice.key} wedding={sampleOf(choice.template)} /> : null;
    case 'contract':
      // The signing block shows exactly who the step asks to sign, so Who signs is seen changing the page.
      return <ContractPreview contract={{ ...sampleContract(account.terms), signers: signersFor(step, account.mc?.name ?? account.business) }} />;
    case 'invoice':
      // A balance step bills what the deposit left; every other invoice step reads as the deposit.
      return <InvoicePreview invoice={/balance/i.test(step.name) ? sampleInvoice('Final payment', 3600, 1200) : sampleDeposit(account)} />;
    case 'questionnaire':
      return (
        <div className="bg-field p-16">
          <ClientView template={questionnaire ?? SAMPLE_QUESTIONNAIRE} answers={{}} onAnswer={() => {}} />
        </div>
      );
    case 'runSheet':
      return <RunSheetPage client="Sarah & Tom" when="Sat 12 Mar 2027 · Stones of the Yarra Valley" moments={sheet.moments.length ? sheet.moments : SAMPLE_MOMENTS} />;
    default:
      return null;
  }
}

/** The step's document: at 85% for the step dialog's canvas (794px fits its 688px), or at full size. */
export function StepPreview({ step, fit = 'peek' }: { step: JourneyStep; fit?: PreviewFit }) {
  const page = usePage(step);
  if (!page) return <InWords step={step} />;
  // Already an A4 sheet that scales itself to the width it is given.
  if (PAPER.has(step.kind)) return <div aria-hidden={fit === 'peek' || undefined} inert={fit === 'peek' || undefined}>{page}</div>;
  if (fit === 'full') return <div className="mx-auto w-[794px] max-w-full overflow-hidden rounded-panel">{page}</div>;
  return (
    // zoom, not scale: it shrinks the page's layout box too, so the canvas scrolls exactly as far as the page goes.
    <div aria-hidden="true" inert className="mx-auto w-[794px] overflow-hidden rounded-panel bg-field shadow-sm ring-1 ring-hairline [zoom:0.85]">
      {page}
    </div>
  );
}

/** A step with no page to draw: its glyph, name and what it sends. */
function InWords({ step }: { step: JourneyStep }) {
  const Icon = STEP_ICON[step.kind];
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 px-8 text-center">
      <IconCircle icon={Icon} size="lg" />
      <p className="type-label text-zebra-950">{step.detail}</p>
      <p className="max-w-60 type-body text-zebra-500">
        Not written yet. Open editor to write it, and it shows here as your client will see it.
      </p>
    </div>
  );
}
