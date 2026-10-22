'use client';

import { useState } from 'react';

import { AskZebri } from '../ask-zebri';
import { AtRiskLink } from '../at-risk-link';
import { greetingFor, headline, type QuickStartId } from '../briefing';
import { CLIENTS } from '../clients/clients-data';
import { ClientProfile } from '../clients/profile/client-profile';
import { useNextMoves } from '../clients/use-next-moves';
import { DEMO_USER, NEXT_EVENT } from '../demo-data';
import type { DocumentKind } from '../documents/kinds';
import { useShowcase } from '../showcase';
import { UpNext, type CountTarget } from '../up-next';

import { RunSheetDialog } from './run-sheet-dialog';
import { SendInvoiceDialog } from './send-invoice-dialog';

/**
 * Home's column (the greeting and headline, Ask Zebri, Up next) and
 * every dialog it opens. Nothing on Home opens in place: a client's
 * name opens their profile, a quick start opens the dialog that does
 * the job, the next event opens its run sheet, and a count leads to
 * the page (or panel) where those things live.
 *
 * @module app/design-system/v2/pages/dashboard/home/home-view
 */

/** Where Home can send the MC: a page, and the tab to open it on. */
export type HomeDestination =
  | { page: 'Documents'; kind: DocumentKind; startNew?: true | undefined }
  | { page: 'Payments'; tab: 'invoices' };

export interface HomeViewProps {
  now: Date;
  /** When the next event starts. */
  eventAt: Date;
  heading: 'h1' | 'h2';
  onNavigate: (to: HomeDestination) => void;
  /** Opens the Enquiries panel, top right. */
  onOpenEnquiries: () => void;
  /** Whether the Enquiries block is added; without it the new enquiries count is left out. */
  enquiriesOn?: boolean | undefined;
}

// The page settles in once on load: each block rises a few pixels a beat
// after the one above. Delays are full literals so Tailwind emits them.
const RISE = 'motion-safe:animate-rise-in';
const DELAY = ['', '[animation-delay:60ms]', '[animation-delay:120ms]'];

/** Home. See {@link HomeViewProps}. */
export function HomeView({
  now,
  eventAt,
  heading: Heading,
  onNavigate,
  onOpenEnquiries,
  enquiriesOn = true,
}: HomeViewProps) {
  const { win, risk } = headline(now);
  const moves = useNextMoves();
  const showcase = useShowcase();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [quick, setQuick] = useState<QuickStartId | null>(null);
  // The run sheet opens from Build a run sheet (no event yet) or the
  // event's row; `seq` gives each opening a fresh dialog.
  const [sheet, setSheet] = useState<{ client: string | null; seq: number } | null>(null);
  const [seq, setSeq] = useState(0);
  const openQuick = (id: QuickStartId) => {
    setSeq((n) => n + 1);
    if (id === 'run-sheet') setSheet({ client: null, seq });
    // A proposal starts where every proposal does: New proposal, then Ready to send (2026-10-08 review: Home had its own
    // three-step dialog with a plain email, a second way to send that showed none of what saying yes sets going).
    else if (id === 'proposal') onNavigate({ page: 'Documents', kind: 'proposals', startNew: true });
    else setQuick(id);
  };
  const count = (target: CountTarget) => {
    if (target === 'enquiries') onOpenEnquiries();
    else if (target === 'outstanding') onNavigate({ page: 'Payments', tab: 'invoices' });
    else onNavigate({ page: 'Documents', kind: target === 'unsigned' ? 'proposals' : target });
  };

  return (
    // The column starts a fixed share of the way down the screen
    // (roughly centred at rest) rather than being centred with
    // `my-auto`, so it sits still whatever loads beneath it.
    // A showcase still sits a set distance down: 16vh is the visitor's screen, not the frame's.
    <div className={`mx-auto w-full max-w-3xl space-y-5 px-4 pb-24 pt-6 md:px-8 ${showcase ? 'md:pt-14 shot:px-8 shot:pt-14' : 'md:pt-[16vh]'}`}>
      <header className={`space-y-3 pb-4 text-center ${RISE}`}>
        <Heading className="type-title text-zebra-950 md:type-display shot:type-display">
          {greetingFor(now.getHours())}, {showcase?.firstName ?? DEMO_USER.firstName}
        </Heading>
        {win || risk ? (
          <p className="mx-auto max-w-xl text-balance type-lead text-zebra-500">
            {win}
            {win && risk ? ' ' : null}
            {risk ? (
              <>
                <AtRiskLink client={risk.client} onOpen={() => setProfileId(risk.id)} />{' '}
                {risk.reason}
              </>
            ) : null}
          </p>
        ) : null}
      </header>
      <div className={`${RISE} ${DELAY[1]}`}>
        {/* A still's focal point is Up next (`showcase.ts`): the composer steps back. */}
        <div className={showcase ? 'opacity-60' : undefined}>
          <AskZebri onQuickStart={openQuick} />
        </div>
      </div>
      <div className={`pt-5 ${RISE} ${DELAY[2]}`}>
        <UpNext
          at={eventAt}
          now={now}
          onOpenEvent={() => {
            setSeq((n) => n + 1);
            setSheet({ client: NEXT_EVENT.client, seq });
          }}
          onCount={count}
          enquiriesOn={enquiriesOn}
        />
      </div>

      <ClientProfile
        client={CLIENTS.find((c) => c.id === profileId) ?? null}
        moves={moves}
        onClose={() => setProfileId(null)}
      />
      <SendInvoiceDialog
        key={`invoice-${seq}`}
        open={quick === 'invoice'}
        onClose={() => setQuick(null)}
        onViewAll={() => onNavigate({ page: 'Payments', tab: 'invoices' })}
      />
      <RunSheetDialog
        key={`sheet-${sheet?.seq ?? 'closed'}`}
        open={sheet !== null}
        client={sheet?.client ?? null}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
