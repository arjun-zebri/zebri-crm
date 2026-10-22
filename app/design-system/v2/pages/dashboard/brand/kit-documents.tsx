'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { Dropdown } from '@/components/ui-v2/dropdown';
import { DocumentsIcon } from '@/components/ui-v2/icons';

import { brandVars } from '../../onboarding/brand-doc-parts';
import { useAccount } from '../account';
import { TemplatePage } from '../doc-builder/doc-types/proposal/template-page';
import { useTemplateChoices } from '../doc-builder/doc-types/proposal/template-store';
import { sampleDeposit } from '../documents/invoice-templates';
import { sampleContract } from '../documents/samples';
import { RunSheetPage } from '../home/run-sheet-page';
import { SAMPLE_MOMENTS, SAMPLE_QUESTIONNAIRE } from '../journeys/step-samples';
import { ContractPreview } from '../payments/modal/contract-preview';
import { InvoicePreview } from '../payments/modal/invoice-preview';
import { sampleOf } from '../proposals/proposal-preview';
import { BRAND } from '../proposals/templates-data';
import { ClientView } from '../questionnaires/client-view/client-view';
import { useTemplates } from '../questionnaires/questionnaire-store';

import { KitEmailPreview } from './kit-email-preview';

/**
 * The brand kit's preview: every kind of document the MC sends, drawn by
 * the real renderers with the sample couple, one at a time and large
 * enough to read (founder, 2026-10-10: "the brand kit needs to show all
 * the documents. the preview is way too tiny"). The menu over the page
 * (a document glyph and its name, founder's mockup 2026-10-11) flips
 * between them, so a colour picked on the left is seen landing on
 * each. Read-only. The page scales to fit the pane's width, never past
 * full size. The contract and invoice draw their own `DocumentPage`, so
 * they get no second frame here; the rest (a proposal's long page, the
 * email, the questionnaire, the run sheet) run longer than an A4 sheet,
 * so they get the same paper edge drawn here.
 *
 * @module app/design-system/v2/pages/dashboard/brand/kit-documents
 */

/** The documents the preview can show, in the switch's order. */
export type KitDoc = 'proposal' | 'contract' | 'invoice' | 'email' | 'questionnaire' | 'runSheet';

const DOCS: readonly KitDoc[] = ['proposal', 'contract', 'invoice', 'email', 'questionnaire', 'runSheet'];
const LABELS: Record<KitDoc, string> = { proposal: 'Proposal', contract: 'Contract', invoice: 'Invoice', email: 'Email', questionnaire: 'Questionnaire', runSheet: 'Run sheet' };
const OPTIONS = DOCS.map((d) => ({ value: d, label: LABELS[d] }));

/** The documents whose renderer draws its own `DocumentPage` (frame and fit). */
const PAGED: ReadonlySet<KitDoc> = new Set(['contract', 'invoice']);

/** An A4 page's width at full size, as every document page draws it. */
const PAGE = 794;
/** The email as a desktop inbox shows it: its 600px card on the brand wash. */
const EMAIL = 680;

/** `doc`'s page, full size, with the sample couple. */
function usePage(doc: KitDoc): ReactNode {
  const account = useAccount();
  const choice = useTemplateChoices()[0];
  const questionnaire = useTemplates()[0];
  switch (doc) {
    case 'proposal':
      return choice ? <TemplatePage template={choice.key} wedding={sampleOf(choice.template)} /> : null;
    case 'contract':
      return <ContractPreview contract={sampleContract(account.terms)} />;
    case 'invoice':
      return <InvoicePreview invoice={sampleDeposit(account)} />;
    case 'email':
      return <KitEmailPreview />;
    case 'questionnaire':
      return (
        <div className="bg-[var(--b-paper)] p-16">
          <ClientView template={questionnaire ?? SAMPLE_QUESTIONNAIRE} answers={{}} onAnswer={() => {}} />
        </div>
      );
    case 'runSheet':
      return <RunSheetPage client="Sarah & Tom" when="Sat 12 Mar 2027 · Stones of the Yarra Valley" moments={SAMPLE_MOMENTS} />;
  }
}

/** The preview, opening on `doc`. Controlled, so the kit's Email tab can turn it to the email. */
export function KitDocuments({ doc, onDoc }: { doc: KitDoc; onDoc: (doc: KitDoc) => void }) {
  const page = usePage(doc);
  const { brand } = useAccount();
  const width = doc === 'email' ? EMAIL : PAGE;
  // The pane's width decides the scale; measured, since CSS zoom cannot read its container.
  const pane = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const el = pane.current;
    if (!el) return;
    const measure = () => setFit(Math.min(1, (el.clientWidth - 48) / width));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [width]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-5 py-4 text-zebra-500">
        <DocumentsIcon aria-hidden="true" className="size-4" />
        <Dropdown inline label="Document" options={OPTIONS} value={doc} onChange={(d) => onDoc(d as KitDoc)} />
      </div>
      <div ref={pane} className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-2">
        {PAGED.has(doc) ? (
          <div key={doc} aria-hidden="true" inert style={brandVars(brand ?? BRAND)} className="motion-safe:animate-fade-in">
            {page}
          </div>
        ) : (
          <div
            key={doc}
            aria-hidden="true"
            inert
            // zoom, not scale: it shrinks the layout box too, so the pane scrolls exactly as far as the page goes. The fit is measured.
            style={{ ...brandVars(brand ?? BRAND), zoom: fit, width }}
            className="mx-auto overflow-hidden rounded-check bg-[var(--b-paper)] shadow-lg ring-1 ring-hairline motion-safe:animate-fade-in"
          >
            {page}
          </div>
        )}
      </div>
    </div>
  );
}
