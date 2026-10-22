'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';

import { AccountContext } from './account';
import { setBdmOn } from './bdm/bdm-store';
import { useCoupleFormReturns } from './bdm/couple-form-link';
import { BlocksModal } from './blocks/blocks-modal';
import { sidebarItems, useBlocks } from './blocks/use-blocks';
import { BrandKitDialog } from './brand/brand-kit-dialog';
import { BrandProvider } from './brand/brand-provider';
import { DesignDialog } from './canvas/docs/design-dialog';
import { CLIENTS } from './clients/clients-data';
import { ClientsPage } from './clients/clients-page';
import { DashboardSidebar } from './dashboard-sidebar';
import { nextEventAt } from './demo-data';
import { DocumentsPage, type DocumentsEntry } from './documents/documents-page';
import { useEnquiriesConfigured } from './enquiries/settings/use-enquiry-settings';
import { runSheetLanding, type LandingDoc } from './first-run/run-sheet-landing';
import { HomeView, type HomeDestination } from './home/home-view';
import { JourneysPage } from './journeys/journeys-page';
import { PaymentsPage } from './payments/payments-page';
import { SettingsDialog } from './settings/settings-dialog';
import { openSettings } from './settings/settings-store';
import { ShowcaseContext, type Showcase } from './showcase';
import { TopActions, type TopPanel } from './top-actions';
import { useDemoAccount } from './use-demo-account';

/**
 * The v2 dashboard (Home): the floating sidebar and, on the grass and
 * sky backdrop, Home itself (`home/home-view.tsx`: a greeting and its
 * headline, the "Ask Zebri" composer, one Up next panel, and the
 * dialogs they open). Blocks (sidebar, or top right on
 * phones) opens a dialog where the MC picks which tools the sidebar shows. Clients in the sidebar swaps Home for
 * the Clients page (see `clients/clients-page.tsx`), Documents for the
 * Documents page (`documents/documents-page.tsx`), Payments for the
 * Payments page (`payments/payments-page.tsx`), Journeys for the
 * Journeys page (`journeys/journeys-page.tsx`, the only automation page:
 * Workflows was removed 2026-10-14). The Email page (newsletters) was
 * taken out with its block on 2026-10-20. Each has its own URL
 * (`/design-system/v2/dashboard/clients`, `/documents`, `/payments`,
 * `/journeys`) so a page can be sent for review, and Back
 * works; the old `#clients` style links still open, and an old
 * `/workflows` link opens Journeys. Inside the showroom
 * preview the address is left alone. Built only from v2 pieces; all content is
 * demo data.
 *
 * Client-only (see `dashboard-client.tsx`): the greeting and the
 * days-to-go badge depend on the viewer's clock.
 *
 * @module app/design-system/v2/pages/dashboard/dashboard-page
 */

export interface DashboardPageV2Props {
  /** Render inside a showroom preview frame instead of filling the screen. */
  contained?: boolean;
  /** Open with the sidebar collapsed to its icon rail (the marketing hero's still of Home). */
  sidebarCollapsed?: boolean;
  /**
   * Render as the marketing hero's still (see `showcase.ts`): a fictional
   * MC, Home near the top, and the frame's height set by the parent
   * rather than the preview's fixed 56rem.
   */
  showcase?: Showcase | undefined;
}

// The page settles in once on load: each block rises a few pixels a beat
// after the one above. Delays are full literals so Tailwind emits them.
const RISE = 'motion-safe:animate-rise-in';

/** The sidebar pages that have a view in the preview; the rest go nowhere yet. */
const PAGES = ['Home', 'Clients', 'Journeys', 'Documents', 'Payments'] as const;
type Page = (typeof PAGES)[number];
const isPage = (label: string): label is Page => (PAGES as readonly string[]).includes(label);
const BASE = '/design-system/v2/dashboard';
/** The page the address opens on: `/…/dashboard/clients` (or the older `#clients`), else Home. */
const fromLocation = ({ pathname, hash }: Location): Page => {
  const slug = pathname.startsWith(`${BASE}/`)
    ? pathname.slice(BASE.length + 1).split('/')[0]
    : hash.slice(1);
  // Workflows was folded into Journeys (2026-10-14): links sent before then still land.
  if (slug === 'workflows') return 'Journeys';
  return PAGES.find((p) => p !== 'Home' && p.toLowerCase() === slug) ?? 'Home';
};

/** v2 dashboard. See {@link DashboardPageV2Props}. */
export function DashboardPageV2({ contained = false, sidebarCollapsed = false, showcase }: DashboardPageV2Props) {
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);
  // What a couple types on their form, in its own tab, reaches this tab's
  // paperwork wherever the celebrant is, not only while it is open.
  useCoupleFormReturns();
  const [page, setPage] = useState<Page>(() =>
    contained ? 'Home' : fromLocation(window.location),
  );
  // The tab a page opens on when Home leads straight to a list.
  const [entry, setEntry] = useState<HomeDestination | null>(null);
  const [panel, setPanel] = useState<TopPanel | null>(null);
  // Show me on Run sheets or Ceremony scripts (which have no page): Clients
  // opens on the next booked client's run sheet or script. Counted, so a second Show me opens it again.
  const [sheetShown, setSheetShown] = useState(0);
  const [shownDoc, setShownDoc] = useState<LandingDoc>('run-sheet');
  // Counted, so a second Show me on a document block lands on it again.
  const [docShown, setDocShown] = useState(0);
  // Where Documents opens: a kind and its view, from Home's links or a block's Show me.
  const [docEntry, setDocEntry] = useState<DocumentsEntry | undefined>(undefined);
  const navigate = (label: string, to: HomeDestination | null = null, doc?: DocumentsEntry) => {
    if (!isPage(label)) return;
    setEntry(to);
    setDocEntry(
      doc ??
        (to?.page === 'Documents'
          ? { kind: to.kind, ...(to.startNew ? { startNew: true as const } : {}) }
          : undefined),
    );
    // Counted, so starting a second new document from Home opens it afresh.
    if (to?.page === 'Documents' && to.startNew) setDocShown((n) => n + 1);
    setSheetShown(0);
    setClientShown(null);
    setPage(label);
    // The address follows, so a reload stays put and it is the link to send.
    const path = label === 'Home' ? BASE : `${BASE}/${label.toLowerCase()}`;
    if (!contained && window.location.pathname !== path) window.history.pushState(null, '', path);
  };
  // Back and Forward move between pages, as the address says.
  useEffect(() => {
    if (contained) return;
    const onPop = () => (setEntry(null), setPage(fromLocation(window.location)));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [contained]);
  const blocks = useBlocks();
  // The Lodge with BDM block's pieces (Settings tab, paperwork, Home, the bell) read this from its store.
  const bdmOn = blocks.added.has('bdm');
  useEffect(() => setBdmOn(bdmOn), [bdmOn]);
  // Enquiries and Calendar top right stay off until their blocks are added.
  // A showcase still shows a set-up account: Enquiries and Calendar are on, as they are for most MCs.
  const enquiriesLocked = !showcase && !blocks.added.has('lead-capture');
  const enquiriesConfigured = useEnquiriesConfigured();
  const [blocksOpen, setBlocksOpen] = useState(false);
  // Adding Lodge with BDM lands on its paperwork list, where Zebri says what it is
  // for and points at the first Send: the block's whole onboarding, on the real page.
  const hadBdm = useRef(bdmOn);
  useEffect(() => {
    if (bdmOn && !hadBdm.current) {
      setBlocksOpen(false);
      setDocShown((n) => n + 1);
      navigate('Documents', null, { kind: 'paperwork', intro: true });
    }
    hadBdm.current = bdmOn;
    // `navigate` is remade each render; only the block being added should fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bdmOn]);
  const landing = runSheetLanding(CLIENTS, shownDoc);
  const sheetLanding = landing.kind === 'profile' ? landing.openOn : undefined;
  const openBlocks = () => setBlocksOpen(true);
  // A calendar item opens its client: Clients, with their profile up. Counted, so the same client opens again.
  const [clientShown, setClientShown] = useState<{ id: string; n: number } | null>(null);
  const top = {
    onOpenBlocks: openBlocks,
    enquiriesLocked,
    // The calendar holds the booking links to copy, so either block brings it.
    calendarLocked: !showcase && !blocks.added.has('calendar') && !blocks.added.has('scheduler'),
    bookingTypes: blocks.added.has('scheduler'),
    onOpenClient: (id: string) => {
      navigate('Clients');
      setClientShown((c) => ({ id, n: (c?.n ?? 0) + 1 }));
    },
  };
  const [now, setNow] = useState(() => new Date());
  // Keeps the greeting and days-to-go right if the tab is left open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const eventAt = nextEventAt(now);
  const Heading = contained ? 'h2' : 'h1';
  // Kept here, not in Clients, so a client added there is still listed after a page switch.
  const account = useDemoAccount();
  return (
    // One live brand for the whole dashboard: every editor's Style pill writes to it.
    <BrandProvider>
      <ShowcaseContext.Provider value={showcase ?? null}>
      {/* `isolate` gives the backdrop's -z-10 a stacking context of its own;
        the padding is the gap that lets the sidebar float clear of the window. */}
      <div
        className={`relative isolate flex md:gap-3 md:p-3 shot:gap-3 shot:p-3 ${contained ? `${showcase ? 'h-full' : 'h-[56rem]'} overflow-hidden rounded-panel` : 'h-dvh'}`}
      >
        <Backdrop contained={contained} />
        <DashboardSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          items={sidebarItems(blocks.added, blocks.hidden, { journeys: true })}
          current={page}
          onNavigate={navigate}
          onOpenBlocks={openBlocks}
          onOpenSettings={() => openSettings()}
        />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          {/* Home's top row, matching every other page's PageBar: its name
            small on the left, the icons on the right, in the same spots.
            Other pages carry their own bar; phones keep the Z. */}
          <div
            className={`flex min-h-9 items-center justify-between p-3 md:justify-end md:pb-0 md:pl-5 md:pr-2 shot:justify-end shot:pb-0 shot:pl-5 shot:pr-2 ${page !== 'Home' ? 'md:hidden' : ''}`}
          >
            {/* Phones have no sidebar; the Z keeps the page anchored. */}
            <Image
              src="/zebri-icon.svg"
              alt="Zebri"
              width={28}
              height={28}
              className="size-7 mix-blend-multiply md:hidden shot:hidden"
            />
            {page === 'Home' ? <TopActions {...top} panel={panel} onPanel={setPanel} /> : null}
          </div>
          {page === 'Clients' ? (
            <div className={RISE}>
              <AccountContext.Provider value={account}>
                <ClientsPage
                  key={`${sheetShown}-${clientShown?.n ?? 0}`}
                  heading={Heading}
                  actions={<TopActions {...top} />}
                  openOn={
                    sheetShown ? sheetLanding : clientShown ? { id: clientShown.id } : undefined
                  }
                />
              </AccountContext.Provider>
            </div>
          ) : page === 'Journeys' ? (
            // Full height from md up, so the page can scroll only its line of steps; on a phone the whole page scrolls.
            <div className={`${RISE} md:h-full`}>
              <JourneysPage
                heading={Heading}
                actions={<TopActions {...top} />}
                onNavigate={(to, doc) => {
                  if (to === 'Documents') setDocShown((n) => n + 1);
                  navigate(to, null, doc);
                }}
              />
            </div>
          ) : page === 'Documents' ? (
            <div className={RISE}>
              {/* Keyed by where it opens, so Show me lands afresh on its kind. */}
              <DocumentsPage
                key={docEntry ? `${docEntry.kind}-${docShown}` : 'documents'}
                heading={Heading}
                actions={<TopActions {...top} />}
                added={blocks.added}
                entry={docEntry}
              />
            </div>
          ) : page === 'Payments' ? (
            <div className={RISE}>
              <PaymentsPage
                heading={Heading}
                actions={<TopActions {...top} />}
                initialTab={entry?.page === 'Payments' ? entry.tab : undefined}
              />
            </div>
          ) : (
            <HomeView
              now={now}
              eventAt={eventAt}
              heading={Heading}
              onNavigate={(to) => navigate(to.page, to)}
              onOpenEnquiries={() => setPanel('enquiries')}
              enquiriesOn={!enquiriesLocked && enquiriesConfigured}
            />
          )}
        </main>
        <SettingsDialog />
        <BrandKitDialog />
        <DesignDialog />
        <BlocksModal
          open={blocksOpen}
          onClose={() => setBlocksOpen(false)}
          blocks={blocks}
          onLaunch={(b) => {
            // Enquiries and Calendar are top-right popovers; Home's icons are the ones the page controls.
            if (b.id === 'lead-capture' || b.id === 'calendar') {
              navigate('Home');
              return setPanel(b.id === 'calendar' ? 'calendar' : 'enquiries');
            }
            if (b.id === 'scheduler') return openSettings('booking-links');
            // The automation block (id kept from when it was Workflows) is Journeys.
            if (b.id === 'workflows') return navigate('Journeys');
            if (b.id === 'proposals' || b.id === 'contracts' || b.id === 'questionnaires') {
              setDocShown((n) => n + 1);
              return navigate('Documents', null, { kind: b.id });
            }
            if (b.id === 'bdm') {
              setDocShown((n) => n + 1);
              return navigate('Documents', null, { kind: 'paperwork' });
            }
            if (b.id !== 'timeline' && b.id !== 'scripts') return;
            setShownDoc(b.id === 'scripts' ? 'script' : 'run-sheet');
            navigate('Clients');
            setSheetShown((n) => n + 1);
          }}
        />
      </div>
      </ShowcaseContext.Provider>
    </BrandProvider>
  );
}
