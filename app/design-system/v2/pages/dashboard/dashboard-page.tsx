'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';

import { BackdropDimContext } from './backdrop-dim';
import { BlocksModal } from './blocks/blocks-modal';
import { sidebarItems, useBlocks } from './blocks/use-blocks';
import { ClientsPage } from './clients/clients-page';
import { DashboardSidebar } from './dashboard-sidebar';
import { nextEventAt } from './demo-data';
import { EmailPage } from './email/email-page';
import { HomeView, type HomeDestination } from './home/home-view';
import { PaymentsPage } from './payments/payments-page';
import { ProposalsPage } from './proposals/proposals-page';
import { TopActions, type TopPanel } from './top-actions';
import { WorkflowsPage } from './workflows/workflows-page';

/**
 * The v2 dashboard (Home): the floating sidebar and, on the grass and
 * sky backdrop, Home itself (`home/home-view.tsx`: a greeting and its
 * headline, the "Ask Zebri" composer, one Up next panel, and the
 * dialogs they open). Blocks (sidebar, or top right on
 * phones) opens a dialog where the MC picks which tools the sidebar shows. Clients in the sidebar swaps Home for
 * the Clients page (see `clients/clients-page.tsx`), Proposals for the
 * Proposals page (`proposals/proposals-page.tsx`), Payments for the
 * Payments page (`payments/payments-page.tsx`), Workflows for the
 * Workflows page (`workflows/workflows-page.tsx`), Email for the Email
 * page (`email/email-page.tsx`); `#clients`, `#proposals`, `#payments`,
 * `#workflows` or `#email` in the URL opens straight onto it, which is also the way in on phones, where
 * there is no sidebar yet. Built only from v2 pieces; all content is
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
}

// The page settles in once on load: each block rises a few pixels a beat
// after the one above. Delays are full literals so Tailwind emits them.
const RISE = 'motion-safe:animate-rise-in';

/** The sidebar pages that have a view in the preview; the rest go nowhere yet. */
const PAGES = ['Home', 'Clients', 'Proposals', 'Payments', 'Workflows', 'Email'] as const;
type Page = (typeof PAGES)[number];
const isPage = (label: string): label is Page => (PAGES as readonly string[]).includes(label);
/** The page a hash opens on: `#clients`, `#proposals`, `#payments`, `#workflows` or `#email`, else Home. */
const fromHash = (hash: string): Page =>
  PAGES.find((p) => p !== 'Home' && `#${p.toLowerCase()}` === hash) ?? 'Home';

/** v2 dashboard. See {@link DashboardPageV2Props}. */
export function DashboardPageV2({ contained = false }: DashboardPageV2Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState<Page>(() => fromHash(window.location.hash));
  // Keeps the hash in step, so a reload stays on the same page.
  // The tab a page opens on when Home leads straight to a list.
  const [entry, setEntry] = useState<HomeDestination | null>(null);
  const [panel, setPanel] = useState<TopPanel | null>(null);
  const [dim, setDim] = useState(false);
  const navigate = (label: string, to: HomeDestination | null = null) => {
    if (!isPage(label)) return;
    setEntry(to);
    setPage(label);
    window.history.replaceState(
      null,
      '',
      label === 'Home' ? window.location.pathname : `#${label.toLowerCase()}`,
    );
  };
  const blocks = useBlocks();
  const [blocksOpen, setBlocksOpen] = useState(false);
  const openBlocks = () => setBlocksOpen(true);
  const [now, setNow] = useState(() => new Date());
  // Keeps the greeting and days-to-go right if the tab is left open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const eventAt = nextEventAt(now);
  const Heading = contained ? 'h2' : 'h1';
  return (
    // `isolate` gives the backdrop's -z-10 a stacking context of its own;
    // the padding is the gap that lets the sidebar float clear of the window.
    <div
      className={`relative isolate flex md:gap-3 md:p-3 ${contained ? 'h-[56rem] overflow-hidden rounded-panel' : 'h-dvh'}`}
    >
      <Backdrop contained={contained} dim={dim} />
      <DashboardSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        items={sidebarItems(blocks.added, blocks.hidden)}
        current={page}
        onNavigate={navigate}
        onOpenBlocks={openBlocks}
      />
      {/* setDim is stable, so the provider never re-renders its readers. */}
      <BackdropDimContext.Provider value={setDim}>
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          {/* On every page but Home the icons move into the page's title
            row, so the title starts level with the sidebar; phones keep the Z. */}
          <div
            className={`flex items-center justify-between p-3 md:justify-end md:p-1 ${page !== 'Home' ? 'md:hidden' : ''}`}
          >
            {/* Phones have no sidebar; the Z keeps the page anchored. */}
            <Image
              src="/zebri-icon.svg"
              alt="Zebri"
              width={28}
              height={28}
              className="size-7 mix-blend-multiply md:hidden"
            />
            {page === 'Home' ? (
              <TopActions onOpenBlocks={openBlocks} panel={panel} onPanel={setPanel} />
            ) : null}
          </div>
          {page === 'Clients' ? (
            <div className={RISE}>
              <ClientsPage heading={Heading} actions={<TopActions onOpenBlocks={openBlocks} />} />
            </div>
          ) : page === 'Proposals' ? (
            <div className={RISE}>
              <ProposalsPage
                heading={Heading}
                actions={<TopActions onOpenBlocks={openBlocks} />}
                initialTab={entry?.page === 'Proposals' ? entry.tab : undefined}
              />
            </div>
          ) : page === 'Workflows' ? (
            // A column at least the screen tall, so the Ask bar rests at the foot on a short page.
            <div className={`flex min-h-full flex-col ${RISE}`}>
              <WorkflowsPage heading={Heading} actions={<TopActions onOpenBlocks={openBlocks} />} />
            </div>
          ) : page === 'Email' ? (
            <div className={RISE}>
              <EmailPage heading={Heading} actions={<TopActions onOpenBlocks={openBlocks} />} />
            </div>
          ) : page === 'Payments' ? (
            <div className={RISE}>
              <PaymentsPage
                heading={Heading}
                actions={<TopActions onOpenBlocks={openBlocks} />}
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
            />
          )}
        </main>
      </BackdropDimContext.Provider>
      <BlocksModal open={blocksOpen} onClose={() => setBlocksOpen(false)} blocks={blocks} />
    </div>
  );
}
