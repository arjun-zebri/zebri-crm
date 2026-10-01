'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';

import { AccountContext } from '../account';
import { BlocksModal } from '../blocks/blocks-modal';
import { CATALOG, blockById } from '../blocks/catalog';
import { sidebarItems, useBlocks } from '../blocks/use-blocks';
import { greetingFor } from '../briefing';
import { ClientsPage } from '../clients/clients-page';
import { DashboardSidebar } from '../dashboard-sidebar';
import { coupleName } from '../payments/payments-data';
import { PaymentsPage } from '../payments/payments-page';
import { ProposalsPage } from '../proposals/proposals-page';
import { TopActions, type TopPanel } from '../top-actions';
import type { CountTarget } from '../up-next';

import { BookedCelebration } from './booked-celebration';
import { BuildYourZebri } from './build-your-zebri';
import { EmptyPage } from './empty-page';
import { FirstHome } from './first-home';
import { STARTING_BLOCKS } from './handoff';
import { eventsOf, headlineOf, rowsOf, type Act, type Look } from './home-rows';
import { PlanSheet } from './plan-sheet';
import { Spotlight } from './spotlight';
import { WHERE, countsOf, noticesOf, tourOf, type PageStep } from './tour';
import { useNewAccount } from './use-new-account';

/**
 * The dashboard a new account lands on, straight after the one setup
 * screen. The same floating sidebar (the blocks for the MC's role, no
 * chat history) and the REAL Clients, Proposals and Payments pages, run
 * on the new account (`AccountContext`). The test client is already in.
 *
 * Home is the real Home's column on the new account (`first-home.tsx`):
 * the guide's steps are the MC's to-dos in Up next, and the test
 * client's replies land in the row and in the bell top right, exactly
 * where a real client's will. Build your Zebri opens over Home with only
 * the blocks recommended for the MC's role. A to-do's button opens the
 * real page with its New dialog already up (the job is done in Zebri
 * itself, not in a side flow); on those pages the spotlight rings the
 * same button if the MC wanders there on their own. The plan sheet opens
 * the first time anything is done for a real client.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/first-run-page
 */

/** Where the MC is: a sidebar page, its tab, whether New opens on arrival, and a count that remounts it. */
interface Nav {
  page: string;
  tab?: 'proposals' | 'contracts' | 'invoices' | undefined;
  startNew?: boolean | undefined;
  seq: number;
}

/** The first-run dashboard. */
export function FirstRunPage() {
  const na = useNewAccount();
  const tour = tourOf(na);
  const blocks = useBlocks({
    initial: na.progress.blocks ?? na.handoff.blocks,
    onChange: na.saveBlocks,
  });
  const [collapsed, setCollapsed] = useState(false);
  const [nav, setNav] = useState<Nav>({ page: 'Home', seq: 0 });
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [building, setBuilding] = useState(false);
  const [panel, setPanel] = useState<TopPanel | null>(null);
  // The booking celebration opens a beat after "Clara paid the deposit."
  // has typed out under the greeting, so the line is read first.
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!tour.celebrating) return;
    const t = window.setTimeout(() => setCelebrating(true), 2000);
    return () => window.clearTimeout(t);
  }, [tour.celebrating]);
  const go = (page: string, tab?: Nav['tab'], startNew = false) =>
    setNav((n) => ({ page, tab, startNew, seq: n.seq + 1 }));
  // Contracts live on Payments; the Contracts block's sidebar row opens that tab.
  const navigate = (label: string) =>
    label === 'Contracts' ? go('Payments', 'contracts') : go(label);
  const doStep = (step: PageStep) => go(WHERE[step].page, WHERE[step].tab, true);
  const act = (a: Act) => {
    if (a === 'tools') return setBuilding(true);
    if (a === 'plan') return na.askPlan();
    if (a === 'real') na.startReal();
    doStep(a === 'real' ? 'client' : a);
  };
  const look = (l: Look) =>
    l === 'clients'
      ? go('Clients')
      : l === 'proposals'
        ? go('Proposals', 'proposals')
        : go('Payments', l);
  const count = (t: CountTarget) =>
    t === 'enquiries'
      ? setPanel('enquiries')
      : t === 'outstanding'
        ? go('Payments', 'invoices')
        : go('Proposals', 'proposals');
  // Every send lands the MC back on Home, where the client's replies
  // arrive and the next move waits; left on the list, they missed both.
  const thenHome =
    <A extends unknown[]>(fn: ((...a: A) => void) | undefined) =>
    (...a: A) => {
      fn?.(...a);
      go('Home');
    };
  const account = {
    ...na.account,
    sendProposal: thenHome(na.account.sendProposal),
    sendContract: thenHome(na.account.sendContract),
    sendInvoice: thenHome(na.account.sendInvoice),
  };

  // A real client in the account: until then there is no one to send to or ask about.
  const hasReal = na.progress.clients.some((c) => !c.test);
  const firstName = na.handoff.profile.name.trim().split(/\s+/)[0] ?? '';
  const maxBlock = CATALOG.some(
    (b) => b.tier === 'max' && !b.soon && na.handoff.blocks.includes(b.id),
  );
  // Each page opens as setup reaches it; until then its row shows, greyed.
  const OPENS_AT: Record<string, number> = {
    Proposals: 1,
    Contracts: 2,
    Payments: 3,
    Workflows: 4,
  };
  // The starting blocks join the sidebar only once the step is done (Done
  // in the dialog), not one by one behind it while it is still open.
  const starting = new Set(STARTING_BLOCKS.map((id) => blockById(id)?.name));
  const items = sidebarItems(blocks.added, blocks.hidden)
    .filter((i) => na.progress.toolsPicked || !starting.has(i.label))
    .map((i) => ({
    ...i,
    locked: tour.reach < (OPENS_AT[i.label] ?? 0),
  }));
  const top = {
    onOpenBlocks: () => setBlocksOpen(true),
    blocksLocked: !na.progress.toolsPicked,
    events: eventsOf(na),
    enquiries: [],
    notifications: noticesOf(na),
  };
  const pointing =
    nav.page !== 'Home' && tour.move.step && tour.move.step !== 'tools' && tour.move.button
      ? tour.move.step
      : null;

  return (
    <AccountContext.Provider value={account}>
      <div className="relative isolate flex h-dvh md:gap-3 md:p-3">
        <Backdrop />
        {/* Eases in once on arrival from setup, while Home rises. */}
        <div className="flex shrink-0 motion-safe:animate-[fade-in_400ms_ease-out_both]">
          <DashboardSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
            items={items}
            current={nav.page}
            onNavigate={navigate}
            onOpenBlocks={() => setBlocksOpen(true)}
            // Blocks opens once the starting blocks are in: before that, the to-do on Home is the way in.
            blocksLocked={!na.progress.toolsPicked}
            history={[]}
            userName={na.handoff.profile.name.trim() || 'You'}
          />
        </div>
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          {/* On every page but Home the icons move into the page's title
              row, as on the dashboard; phones keep the Z. */}
          <div
            className={`flex items-center justify-between p-3 md:justify-end md:p-1 ${nav.page !== 'Home' ? 'md:hidden' : ''}`}
          >
            <Image
              src="/zebri-icon.svg"
              alt="Zebri"
              width={28}
              height={28}
              className="size-7 mix-blend-multiply md:hidden"
            />
            {nav.page === 'Home' ? <TopActions {...top} panel={panel} onPanel={setPanel} /> : null}
          </div>
          {nav.page === 'Home' ? (
            <FirstHome
              heading="h1"
              // One greeting for the whole of setup, so the heading never changes under the MC mid-flow.
              greeting={`${tour.onboarded || !firstName ? greetingFor(new Date().getHours()) : 'Welcome to Zebri'}${firstName ? `, ${firstName}` : ''}`}
              headline={headlineOf(na, tour)}
              ask={tour.onboarded}
              quickStarts={hasReal ? ['proposal', 'invoice'] : []}
              scoped={hasReal}
              rows={rowsOf(na, tour)}
              counts={{ enquiries: 0, ...countsOf(na.account) }}
              onAct={act}
              onLook={look}
              onQuickStart={(id) =>
                id === 'proposal'
                  ? go('Proposals', 'proposals', true)
                  : id === 'invoice'
                    ? go('Payments', 'invoices', true)
                    : go('Run sheets')
              }
              onCount={count}
            />
          ) : (
            // Every page switch rises in, as on the dashboard, rather than cutting.
            <div key={`page-${nav.seq}`} className="flex min-h-full flex-col motion-safe:animate-rise-in">
              {nav.page === 'Clients' ? (
                <ClientsPage
                  key={nav.seq}
                  heading="h1"
                  startNew={nav.startNew}
                  actions={<TopActions {...top} />}
                />
              ) : nav.page === 'Proposals' ? (
                <ProposalsPage
                  key={nav.seq}
                  heading="h1"
                  actions={<TopActions {...top} />}
                  initialTab={nav.tab === 'proposals' ? 'proposals' : undefined}
                  startNew={
                    nav.startNew
                      ? tour.current === 'proposal' && tour.who
                        ? tour.who
                        : true
                      : undefined
                  }
                />
              ) : nav.page === 'Payments' ? (
                <PaymentsPage
                  key={nav.seq}
                  heading="h1"
                  actions={<TopActions {...top} />}
                  initialTab={
                    nav.tab === 'contracts' || nav.tab === 'invoices' ? nav.tab : undefined
                  }
                  startNew={
                    nav.startNew ? (nav.tab === 'contracts' ? 'contract' : 'invoice') : undefined
                  }
                />
              ) : (
                <EmptyPage key={nav.page} title={nav.page} heading="h1" onHome={() => go('Home')} />
              )}
            </div>
          )}
        </main>
        {pointing ? (
          <Spotlight
            target={WHERE[pointing].target}
            title={tour.move.title}
            body={tour.move.detail}
          />
        ) : null}
        <PlanSheet
          key={na.gate ?? 'closed'}
          who={na.gate}
          initial={maxBlock ? 'max' : 'pro'}
          onStart={(plan) => (na.startPlan(plan), go('Home'))}
          onClose={na.closeGate}
        />
        <BuildYourZebri
          open={building}
          blocks={blocks}
          onClose={() => setBuilding(false)}
          onDone={() => (setBuilding(false), na.pickedTools())}
        />
        <BlocksModal open={blocksOpen} onClose={() => setBlocksOpen(false)} blocks={blocks} />
        {tour.client ? (
          <BookedCelebration
            open={celebrating && tour.celebrating}
            couple={tour.who}
            when={`${tour.client.date} · ${tour.client.venue}`}
            paid={na.account.invoices.find((i) => i.paidOn && coupleName(i.names) === tour.who)?.amount ?? 0}
            onClose={() => (setCelebrating(false), na.celebrate(), go('Home'))}
          />
        ) : null}
      </div>
    </AccountContext.Provider>
  );
}
