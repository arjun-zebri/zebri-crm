'use client';

import { useEffect, type ReactNode } from 'react';

import { EmptyState } from '@/components/ui-v2/empty-state';
import { DocumentsIcon } from '@/components/ui-v2/icons';

import { useJourneys, type JourneysSource } from '../journeys/use-journeys';
import { PageBar } from '../page-bar';
import { PageFrame } from '../page-frame';

import { journeyStepOf } from './journey-step-of';
import { KindSection } from './kind-section';
import { kindsFor, type DocumentKind } from './kinds';
import { NewMenu } from './new-menu';
import { SetupCards } from './setup-cards';
import { useContractDocuments } from './use-contract-documents';
import { useEmailDocuments } from './use-email-documents';
import { useInvoiceDocuments } from './use-invoice-documents';
import { usePaperworkDocuments } from './use-paperwork-documents';
import { useProposalDocuments } from './use-proposal-documents';
import { useQuestionnaireDocuments } from './use-questionnaire-documents';

/**
 * The v2 Documents page: what couples receive from the MC. Kinds with
 * no template yet come first, as setup cards under "Finish your
 * journey"; then a list per kind that has templates (Proposals,
 * Contracts, Invoices, Questionnaires, Emails, Marriage paperwork). A row opens
 * its template's preview, which holds Edit and Use for a couple; New
 * starts a template of any kind. In the sidebar beside Journeys, so a
 * document can be sent at will, off the journey (2026-10-08).
 *
 * Laid out from the founder's 2026-10-09 mockup, in the reading-width
 * frame. No kind filter: the page is short enough to read whole, and
 * arriving on a kind scrolls to it.
 *
 * One page, no page per kind (2026-10-08 founder: "we dont need a
 * separate page for proposals"). Sends are not listed: Home chases them
 * and each client holds their own. A kind shows once its block is added;
 * Emails are on every account.
 * Each kind's rows and dialogs come from its own hook, so this page only
 * composes them.
 *
 * @module app/design-system/v2/pages/dashboard/documents/documents-page
 */

/** Where the page opens: on a kind, and whether to start a new one. */
export interface DocumentsEntry {
  kind: DocumentKind;
  /** Opens on a new one of `kind`: a client's name for a proposal for them, or `true`. */
  startNew?: string | true | undefined;
  /** Just added from Blocks: the kind says what it is for (Marriage paperwork does). */
  intro?: boolean | undefined;
}

export interface DocumentsPageProps {
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons, at the end of the title row. */
  actions?: ReactNode;
  /** The blocks the MC has added: the kinds follow them. */
  added: ReadonlySet<string>;
  entry?: DocumentsEntry | undefined;
  /** Whose journeys say which step sends each kind; the demo's when left out. */
  journeys?: JourneysSource | undefined;
}

/** What each kind is for, under "No … yet" when no journey step waits on it. */
const USE: Record<DocumentKind, string> = {
  proposals: 'Your packages and prices, ready to accept',
  contracts: 'Couples sign online once they accept',
  invoices: 'Deposits and balances, paid by card',
  questionnaires: 'The details you need for the day',
  emails: 'Replies, reminders and thank yous, in your brand',
  paperwork: 'Every booked couple, from their form to registered',
};

/** The Documents page. See {@link DocumentsPageProps}. */
export function DocumentsPage({
  heading: Heading = 'h1',
  actions,
  added,
  entry,
  journeys: source,
}: DocumentsPageProps) {
  const kinds = kindsFor(added);
  const { journeys } = useJourneys(source);
  const docs = {
    proposals: useProposalDocuments({
      startNew: entry?.kind === 'proposals' ? entry.startNew : undefined,
    }),
    contracts: useContractDocuments({
      startNew: entry?.kind === 'contracts' && Boolean(entry.startNew),
    }),
    invoices: useInvoiceDocuments(),
    questionnaires: useQuestionnaireDocuments(),
    emails: useEmailDocuments(),
    paperwork: usePaperworkDocuments({
      intro: entry?.kind === 'paperwork' && Boolean(entry.intro),
    }),
  };
  // Marriage paperwork has no template (the law sets the form), so it is always a list, never a card.
  const sendable = kinds.filter((k) => k.id !== 'paperwork');
  const missing = sendable.filter((k) => docs[k.id].rows.length === 0);
  const lists = kinds.filter((k) => !missing.includes(k));
  const target = entry?.kind;
  // Arriving on a kind (a journey step's Edit, a block just added) lands on its section.
  useEffect(() => {
    if (target) document.getElementById(`kind-${target}`)?.scrollIntoView({ block: 'start' });
  }, [target]);

  return (
    <PageFrame
      labelledBy="documents-title"
      bar={
        <PageBar
          title={
            <Heading id="documents-title" className="sr-only">
              Documents
            </Heading>
          }
          toolbar={<NewMenu kinds={kinds} onNew={(k) => docs[k].newTemplate()} />}
          actions={actions}
        />
      }
    >
      {kinds.length === 0 ? (
        <EmptyState
          icon={DocumentsIcon}
          title="No documents yet"
          body="Add Proposals, Contracts, Payments or Questionnaires from Blocks, and they live here."
        />
      ) : (
        <div className="space-y-10 pt-2">
          {missing.length ? (
            <SetupCards
              ready={sendable.length - missing.length}
              total={sendable.length}
              cards={missing.map((k) => ({
                kind: k,
                use: USE[k.id],
                step: journeyStepOf(journeys, k.id, [])?.step ?? null,
                onSetUp: docs[k.id].newTemplate,
              }))}
            />
          ) : null}
          {lists.length ? (
            <div className="space-y-6">
              {lists.map((k) => (
                <KindSection
                  key={k.id}
                  kind={k}
                  rows={docs[k.id].rows}
                  journey={journeyStepOf(journeys, k.id, docs[k.id].rows)}
                  use={USE[k.id]}
                  onNew={docs[k.id].newTemplate}
                  lead={k.id === 'paperwork' ? docs.paperwork.lead : null}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
      {docs.proposals.dialogs}
      {docs.contracts.dialogs}
      {docs.invoices.dialogs}
      {docs.questionnaires.dialogs}
      {docs.emails.dialogs}
      {docs.paperwork.dialogs}
    </PageFrame>
  );
}
