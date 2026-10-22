'use client';

import type { ReactNode } from 'react';

import { ClientsPage, type ClientsPageProps } from '../clients/clients-page';
import { DocumentsPage, type DocumentsEntry } from '../documents/documents-page';
import { BookingLinksFirstUse } from '../first-use/booking-links-first-use';
import type { Visitor } from '../journeys/journey-path';
import { JourneysPage } from '../journeys/journeys-page';
import type { JourneysSource } from '../journeys/use-journeys';
import { PaymentsPage } from '../payments/payments-page';

import { EmptyPage } from './empty-page';
import type { PageTab } from './routes';

/**
 * The first-run dashboard's pages other than Home: the REAL Clients,
 * Journeys, Documents and Payments pages on the new account, and the
 * first-use pages. Split out of the first-run page so that file stays
 * the orchestrator (which page, the guide, the dialogs) and this one is
 * only which component a page is.
 *
 * Journeys runs on the new account's own starter journey
 * (`journeys.source`), with the test client shown on their step.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/first-run-pages
 */

export interface FirstRunPagesProps {
  /** The page, its tab, whether its New opens on arrival, and the count that remounts it. */
  nav: { page: string; tab?: PageTab | undefined; startNew?: boolean | undefined; seq: number };
  /** The top-right icons, in each page's title row. */
  actions: ReactNode;
  /** The blocks in the sidebar. */
  added: ReadonlySet<string>;
  /** Where Documents opens (a kind, New for a client). */
  documents: DocumentsEntry | undefined;
  /** The client profile Clients opens on, for one arrival: Show me on a run sheet, or a couple's timeline. */
  openOn: ClientsPageProps['openOn'] | null;
  /** The first run's journey, the test client on it, and whether the line plays in (arriving from the celebration). */
  journeys: { source: JourneysSource; visitors: Visitor[]; reveal?: boolean | undefined };
  /** Journeys' line under the title after the practice run (`JourneyBookedLine`). */
  journeyIntro?: ReactNode;
  /** Journeys' way to other pages: Documents on a kind, Clients, Email. */
  onNavigate: (page: string, doc?: DocumentsEntry) => void;
  onHome: () => void;
}

/** The page for `nav.page`. See {@link FirstRunPagesProps}. */
export function FirstRunPages({ nav, actions, added, documents, openOn, journeys, journeyIntro, onNavigate, onHome }: FirstRunPagesProps) {
  switch (nav.page) {
    case 'Clients':
      return <ClientsPage key={nav.seq} heading="h1" startNew={nav.startNew} openOn={openOn ?? undefined} actions={actions} />;
    case 'Journeys':
      return (
        <JourneysPage
          key={nav.seq}
          heading="h1"
          actions={actions}
          source={journeys.source}
          visitors={journeys.visitors}
          tour="journey-line"
          intro={journeyIntro}
          reveal={journeys.reveal}
          addClient={false}
          onNavigate={onNavigate}
        />
      );
    case 'Documents':
      return <DocumentsPage key={nav.seq} heading="h1" actions={actions} added={added} entry={documents} journeys={journeys.source} />;
    case 'Payments':
      return (
        <PaymentsPage
          key={nav.seq}
          heading="h1"
          actions={actions}
          initialTab={nav.tab === 'invoices' ? 'invoices' : undefined}
          startNew={nav.startNew ? 'invoice' : undefined}
        />
      );
    case 'Booking links':
      return <BookingLinksFirstUse heading="h1" actions={actions} />;
    default:
      return <EmptyPage key={nav.page} title={nav.page} heading="h1" actions={actions} onHome={onHome} />;
  }
}
