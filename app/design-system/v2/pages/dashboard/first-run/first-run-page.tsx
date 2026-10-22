'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';
import { Button } from '@/components/ui-v2/button';

import { AccountContext } from '../account';
import { BlocksModal } from '../blocks/blocks-modal';
import { CATALOG, blockById } from '../blocks/catalog';
import { sidebarItems, useBlocks } from '../blocks/use-blocks';
import { BrandKitDialog } from '../brand/brand-kit-dialog';
import { BrandProvider } from '../brand/brand-provider';
import { greetingFor } from '../briefing';
import { DesignDialog } from '../canvas/docs/design-dialog';
import type { ClientsPageProps } from '../clients/clients-page';
import { DashboardSidebar } from '../dashboard-sidebar';
import type { DocumentsEntry } from '../documents/documents-page';
import { coupleName } from '../payments/payments-data';
import { SettingsDialog } from '../settings/settings-dialog';
import { openSettings } from '../settings/settings-store';
import { TopActions, type TopPanel } from '../top-actions';
import type { CountTarget } from '../up-next';

import { BookedCelebration } from './booked-celebration';
import { BuildYourZebri } from './build-your-zebri';
import { FirstHome } from './first-home';
import { FirstRunPages } from './first-run-pages';
import { STARTING_BLOCKS, roleOf } from './handoff';
import { eventsOf, headlineOf, rowsOf, type Act, type Look } from './home-rows';
import { JourneyBookedLine } from './journey-booked-line';
import { dateOf, useFirstRunJourneys } from './journey-place';
import { PlanSheet } from './plan-sheet';
import { documentsEntry, pathOf, routeOf, type PageTab, type Route } from './routes';
import { runSheetLanding, type LandingDoc, type Ring } from './run-sheet-landing';
import { Spotlight } from './spotlight';
import { StepDialog } from './step-dialogs';
import { countsOf, noticesOf, tourOf, type PageStep } from './tour';
import { nextTrick } from './tricks';
import { useFirstRunBdm } from './use-first-run-bdm';
import { useNewAccount } from './use-new-account';
import { ZebriTrick } from './zebri-trick';

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
 * real New dialog over Home (`step-dialogs.tsx`): the job is done in
 * Zebri itself, and the sidebar stays on Home as the MC works through
 * the steps (user, 2026-10-15: jumping tabs at every step). The plan sheet opens
 * the first time anything is done for a real client.
 *
 * Every page has its own URL (`routes.ts`) so one can be sent for review.
 * A link to a page other than Home, opened with nothing saved, lands on
 * an account already past setup (`useNewAccount({ setUp })`).
 *
 * @module app/design-system/v2/pages/dashboard/first-run/first-run-page
 */

/** Where the MC is: a sidebar page, its tab, whether New opens on arrival, and a count that remounts it. */
interface Nav {
  page: string;
  tab?: PageTab | undefined;
  startNew?: boolean | undefined;
  seq: number;
}

const here = (): Route => routeOf(window.location.pathname, window.location.search);

/** The first-run dashboard. */
export function FirstRunPage() {
  // Read once: the URL the page was opened at (client-only, so `window` is there).
  const [arrived] = useState(here);
  const na = useNewAccount({ setUp: arrived.page !== 'Home' || Boolean(arrived.plan) });
  const tour = tourOf(na);
  const blocks = useBlocks({
    initial: na.progress.blocks ?? na.handoff.blocks,
    onChange: na.saveBlocks,
  });
  const [collapsed, setCollapsed] = useState(false);
  const [nav, setNav] = useState<Nav>({
    page: arrived.page,
    tab: arrived.tab,
    startNew: arrived.startNew,
    seq: 0,
  });
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [building, setBuilding] = useState(false);
  const [panel, setPanel] = useState<TopPanel | null>(null);
  // Show me a trick: whether Zebri's answer is up under Ask Zebri, and the
  // trick being shown on its page (with the nav count it was opened at,
  // so moving on to another page puts the ring away).
  const [tricking, setTricking] = useState(false);
  // `/run-sheets` (the old page's link) lands where run sheets live now.
  const [arrivedSheet] = useState(() =>
    arrived.runSheet ? runSheetLanding(na.account.clients) : null,
  );
  const [showing, setShowing] = useState<(Ring & { seq: number }) | null>(
    arrivedSheet?.kind === 'ring' ? { ...arrivedSheet.ring, seq: 0 } : null,
  );
  // Show me on run sheets: the client profile Clients opens on, for that one arrival.
  const [openOn, setOpenOn] = useState<ClientsPageProps['openOn'] | null>(
    arrivedSheet?.kind === 'profile' ? arrivedSheet.openOn : null,
  );
  // The booking celebration opens a beat after "Clara paid the deposit."
  // has typed out under the greeting, so the line is read first.
  const [celebrating, setCelebrating] = useState(false);
  // Journeys straight from the celebration: the line plays in once, ticking off what the MC just did.
  const [revealing, setRevealing] = useState(false);
  // Leaving that Journeys visit, by any route, clears the test client: their part is over.
  const leaveReveal = useRef<(() => void) | null>(null);
  const leftReveal = () => {
    leaveReveal.current?.();
    leaveReveal.current = null;
  };
  useEffect(() => {
    if (!tour.celebrating) return;
    const t = window.setTimeout(() => setCelebrating(true), 2000);
    return () => window.clearTimeout(t);
  }, [tour.celebrating]);
  // The step whose New dialog is open over Home; `seq` opens each one fresh.
  const [stepping, setStepping] = useState<{ step: PageStep; seq: number } | null>(null);
  const go = (page: string, tab?: Nav['tab'], startNew = false) => {
    setNav((n) => ({ page, tab, startNew, seq: n.seq + 1 }));
    setStepping(null);
    setOpenOn(null);
    setRevealing(false);
    leftReveal();
    // The address follows, so it is always the link to send. Without
    // `/new`: a New dialog opened by a to-do should not reopen on reload.
    const path = pathOf({ page, tab });
    if (`${window.location.pathname}${window.location.search}` !== path)
      window.history.pushState(null, '', path);
  };
  // Run sheets have no page: Show me goes to where one lives (`run-sheet-landing.ts`).
  const showRunSheet = (doc: LandingDoc = 'run-sheet') => {
    const to = runSheetLanding(na.account.clients, doc);
    go('Clients');
    if (to.kind === 'profile') setOpenOn(to.openOn);
    else setShowing({ ...to.ring, seq: nav.seq + 1 });
  };
  // Back and Forward move between pages, as the address says.
  useEffect(() => {
    const onPop = () => {
      const r = here();
      setNav((n) => ({ page: r.page, tab: r.tab, startNew: false, seq: n.seq + 1 }));
      setRevealing(false);
      leftReveal();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // `/plan` opens the plan sheet over Home, once, on arrival.
  const askedPlan = useRef(false);
  useEffect(() => {
    if (!arrived.plan || askedPlan.current) return;
    askedPlan.current = true;
    na.askPlan();
  }, [arrived.plan, na]);
  const navigate = (label: string) => go(label);
  const tester = na.progress.clients.find((c) => c.test);
  const doStep = (step: PageStep) => {
    if (nav.page !== 'Home') go('Home');
    setStepping((s) => ({ step, seq: (s?.seq ?? 0) + 1 }));
  };
  const act = (a: Act) => {
    if (a === 'tools') return setBuilding(true);
    if (a === 'plan') return na.askPlan();
    if (a === 'real') na.startReal();
    doStep(a === 'real' ? 'client' : a);
  };
  const look = (l: Look) =>
    l === 'clients'
      ? go('Clients')
      : l === 'proposals' || l === 'contracts'
        ? go('Documents', l)
        : go('Payments', l);
  const count = (t: CountTarget) =>
    t === 'enquiries'
      ? setPanel('enquiries')
      : t === 'outstanding'
        ? go('Payments', 'invoices')
        : go('Documents', t === 'unsigned' ? 'proposals' : t);
  // Every send lands the MC back on Home, where the client's replies
  // arrive and the next move waits; left on the list, they missed both.
  const thenHome =
    <A extends unknown[]>(fn: ((...a: A) => void) | undefined) =>
    (...a: A) => {
      fn?.(...a);
      go('Home');
    };
  const journeys = useFirstRunJourneys(na);
  useFirstRunBdm(blocks.added.has('bdm'), na.handoff.profile.name, na.account.clients);
  // Marriage paperwork just added from Blocks: Documents opens on it with Zebri's line and Start here, that visit only.
  const [bdmIntro, setBdmIntro] = useState<number | null>(null);
  const account = {
    ...na.account,
    journeys: journeys.source,
    sendProposal: thenHome(na.account.sendProposal),
    sendContract: thenHome(na.account.sendContract),
    sendInvoice: thenHome(na.account.sendInvoice),
    runSheets: blocks.added.has('timeline'),
    scripts: blocks.added.has('scripts'),
  };

  // A real client in the account: until then there is no one to send to or ask about.
  const hasReal = na.progress.clients.some((c) => !c.test);
  const trick = nextTrick(na.account, na.progress.tricks ?? [], blocks.added);
  const firstName = na.handoff.profile.name.trim().split(/\s+/)[0] ?? '';
  // A Max block picked in setup, added since (Lodge with BDM), or Max already chosen in Blocks:
  // the plan sheet opens on Max, so it never offers a plan that would lock what they just added.
  const maxBlock =
    blocks.plan === 'max' ||
    CATALOG.some((b) => b.tier === 'max' && !b.soon && (na.handoff.blocks.includes(b.id) || blocks.added.has(b.id)));
  // Each page opens as setup reaches it; until then its row shows, greyed.
  const OPENS_AT: Record<string, number> = {
    Journeys: 1,
    Documents: 1,
    Payments: 3,
  };
  // The starting blocks join the sidebar only once the step is done (Done
  // in the dialog), not one by one behind it while it is still open.
  // Proposals and Contracts start the set, and they show as Journeys and Documents, as on the dashboard.
  const starting = new Set([
    ...STARTING_BLOCKS.map((id) => blockById(id)?.name),
    'Journeys',
    'Documents',
  ]);
  const items = sidebarItems(blocks.added, blocks.hidden, { journeys: true })
    .filter((i) => na.progress.toolsPicked || !starting.has(i.label))
    .map((i) => ({
      ...i,
      locked: tour.reach < (OPENS_AT[i.label] ?? 0),
    }));
  const top = {
    onOpenBlocks: () => setBlocksOpen(true),
    blocksLocked: !na.progress.toolsPicked,
    enquiriesLocked: !blocks.added.has('lead-capture'),
    calendarLocked: !blocks.added.has('calendar') && !blocks.added.has('scheduler'),
    bookingTypes: blocks.added.has('scheduler'),
    events: eventsOf(na),
    enquiries: [],
    notifications: noticesOf(na),
  };
  return (
    <AccountContext.Provider value={account}>
      <BrandProvider>
        <div className="relative isolate flex h-dvh md:gap-3 md:p-3">
          <Backdrop />
          {/* Eases in once on arrival from setup, while Home rises. */}
          <div className="flex shrink-0 motion-safe:animate-fade-in">
            <DashboardSidebar
              collapsed={collapsed}
              onToggle={() => setCollapsed((c) => !c)}
              items={items}
              current={nav.page}
              onNavigate={navigate}
              onOpenBlocks={() => setBlocksOpen(true)}
              onOpenSettings={() => openSettings()}
              // Blocks opens once the starting blocks are in: before that, the to-do on Home is the way in.
              blocksLocked={!na.progress.toolsPicked}
              history={[]}
              userName={na.handoff.profile.name.trim() || 'You'}
            />
          </div>
          <main className="relative min-w-0 flex-1 overflow-y-auto">
            {/* Home's top row, as on the dashboard: its name small, the icons
              on the right, in the same spots as every other page's PageBar. */}
            <div
              className={`flex min-h-9 items-center justify-between p-3 md:justify-end md:pb-0 md:pl-5 md:pr-2 ${nav.page !== 'Home' ? 'md:hidden' : ''}`}
            >
              <Image
                src="/zebri-icon.svg"
                alt="Zebri"
                width={28}
                height={28}
                className="size-7 mix-blend-multiply md:hidden"
              />
              {nav.page === 'Home' ? (
                <TopActions {...top} panel={panel} onPanel={setPanel} />
              ) : null}
            </div>
            {nav.page === 'Home' ? (
              <FirstHome
                heading="h1"
                // One greeting for the whole of setup, so the heading never changes under the MC mid-flow.
                greeting={`${tour.onboarded || !firstName ? greetingFor(new Date().getHours()) : 'Welcome to Zebri'}${firstName ? `, ${firstName}` : ''}`}
                headline={headlineOf(na, tour)}
                ask={tour.onboarded}
                quickStarts={['trick', 'client', 'proposal']}
                trick={
                  tricking ? (
                    <ZebriTrick
                      trick={trick}
                      onShow={() => {
                        if (!trick) return;
                        na.sawTrick(trick.id);
                        setTricking(false);
                        if (trick.id === 'run-sheet') return showRunSheet();
                        setShowing({
                          target: trick.target,
                          title: trick.title,
                          body: trick.body,
                          seq: nav.seq + 1,
                        });
                        go(trick.page, trick.tab);
                      }}
                      onAnother={() => trick && na.sawTrick(trick.id)}
                      onClose={() => setTricking(false)}
                    />
                  ) : null
                }
                scoped={hasReal}
                rows={rowsOf(na, tour)}
                counts={{ enquiries: 0, ...countsOf(na.account) }}
                onAct={act}
                onLook={look}
                onQuickStart={(id) =>
                  id === 'trick'
                    ? setTricking(true)
                    : id === 'client'
                      ? go('Clients', undefined, true)
                      : id === 'proposal'
                        ? go('Documents', 'proposals', true)
                        : id === 'invoice'
                          ? go('Payments', 'invoices', true)
                          : showRunSheet()
                }
                onCount={count}
              />
            ) : (
              // Every page switch rises in, as on the dashboard, rather than cutting.
              <div
                key={`page-${nav.seq}`}
                className="flex min-h-full flex-col motion-safe:animate-rise-in"
              >
                <FirstRunPages
                  nav={nav}
                  actions={<TopActions {...top} />}
                  added={blocks.added}
                  documents={withIntro(
                    documentsEntry(nav, tour.current === 'proposal' ? tour.who : undefined),
                    bdmIntro === nav.seq,
                  )}
                  openOn={openOn}
                  // The booked couple is on the line only for the arrival from the celebration; leaving Journeys
                  // puts the page back to itself, its own subtitle and no couple (founder, 2026-10-08).
                  journeys={{
                    ...journeys,
                    visitors: revealing ? journeys.visitors : [],
                    reveal: revealing,
                  }}
                  journeyIntro={
                    // Arriving from the celebration: the couple just booked, on their journey.
                    revealing && tester ? (
                      <JourneyBookedLine
                        couple={coupleName(tester.names)}
                        planningBy={dateOf(journeys.source.seed[0], tester, 'planning')}
                        balanceOn={dateOf(journeys.source.seed[0], tester, 'balance')}
                      />
                    ) : undefined
                  }
                  onNavigate={(page, doc) => go(page, doc?.kind as PageTab | undefined)}
                  onHome={() => go('Home')}
                />
              </div>
            )}
          </main>
          {/* Only a trick the MC asked for rings a button; the guide never pops one up unasked. */}
          {showing && showing.seq === nav.seq ? (
            <Spotlight
              target={showing.target}
              title={showing.title}
              body={showing.body}
              actions={
                <Button variant="secondary" onClick={() => setShowing(null)}>
                  Got it
                </Button>
              }
            />
          ) : null}
          <PlanSheet
            key={na.gate ?? 'closed'}
            who={na.gate}
            initial={maxBlock ? 'max' : 'pro'}
            role={roleOf(na.handoff.profile.roles)}
            onStart={(plan) => (na.startPlan(plan), go('Home'))}
            onClose={() => {
              na.closeGate();
              // Closed from a `/plan` link: the address goes back to Home's.
              if (window.location.pathname.endsWith('/plan'))
                window.history.replaceState(null, '', pathOf({ page: 'Home' }));
            }}
          />
          <BuildYourZebri
            open={building}
            blocks={blocks}
            role={roleOf(na.handoff.profile.roles)}
            onClose={() => setBuilding(false)}
            onDone={() => (setBuilding(false), na.pickedTools())}
          />
          <SettingsDialog />
          <BrandKitDialog />
          <DesignDialog />
          <BlocksModal
            open={blocksOpen}
            onClose={() => setBlocksOpen(false)}
            blocks={blocks}
            onLaunch={(b) => {
              // Enquiries is the top-right popover; Home's icons are the ones the page controls.
              if (b.id === 'lead-capture') {
                go('Home');
                return setPanel('enquiries');
              }
              if (b.id === 'scheduler') return openSettings('booking-links');
              // The automation block (id kept from when it was Workflows) is Journeys.
              if (b.id === 'workflows') return go('Journeys');
              if (b.id === 'timeline') return showRunSheet();
              if (b.id === 'scripts') return showRunSheet('script');
              if (b.id === 'questionnaires') {
                // Lands on the empty Templates with the ring on New questionnaire: writing one is the first move.
                setShowing({
                  target: 'new-questionnaire',
                  title: 'Write your first questionnaire',
                  body: 'Your own questions, once. Send it from any client.',
                  seq: nav.seq + 1,
                });
                return go('Documents', 'questionnaires');
              }
              if (b.id === 'bdm') {
                setBdmIntro(nav.seq + 1);
                return go('Documents', 'paperwork');
              }
              if (b.id === 'proposals' || b.id === 'contracts') go('Documents', b.id);
            }}
          />
          {tour.client ? (
            <BookedCelebration
              open={celebrating && tour.celebrating}
              couple={tour.who}
              when={`${tour.client.date} · ${tour.client.venue}`}
              paid={
                na.account.invoices.find((i) => i.paidOn && coupleName(i.names) === tour.who)
                  ?.amount ?? 0
              }
              onNext={() => {
                setCelebrating(false);
                na.celebrate();
                go('Journeys');
                setRevealing(true);
                leaveReveal.current = na.dropTest;
              }}
              onClose={() => (setCelebrating(false), na.celebrate(), go('Home'))}
            />
          ) : null}
        </div>
      </BrandProvider>
      {stepping ? <StepDialog key={stepping.seq} step={stepping.step} who={tour.current === 'proposal' ? tour.who : undefined} /> : null}
    </AccountContext.Provider>
  );
}

/** Documents' entry, marked as just added from Blocks when it is. */
function withIntro(entry: DocumentsEntry | undefined, intro: boolean): DocumentsEntry | undefined {
  return entry && intro ? { ...entry, intro } : entry;
}
