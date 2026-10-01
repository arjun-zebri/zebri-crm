import { useAutoAnimate } from '@formkit/auto-animate/react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import Image from 'next/image';

import { Avatar } from '@/components/ui-v2/avatar';
import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';

import { BLOCKS, DEMO_USER, HISTORY, type NavItem } from './demo-data';
import { SidebarRow, fadeLabel } from './sidebar-row';

/**
 * The v2 app sidebar: the Z mark, the main destinations, recent Zebri
 * chats, Blocks and the signed-in user. A glass panel floating on
 * the backdrop, inset from the window edges like the log in card. Which
 * pages show is up to the MC: the rows are the blocks they added, and
 * adding or removing one slides the list rather than jumping it.
 * Hidden below `md`, where the page header takes over.
 *
 * Collapsing animates the width (240px to 64px) while labels fade, and
 * the toggle is the round chevron tab on the right edge, as in the
 * current app's sidebar, so the control is where MCs already look.
 *
 * @module app/design-system/v2/pages/dashboard/dashboard-sidebar
 */

export interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** The page rows, in order. */
  items: NavItem[];
  /** The label of the page on screen. */
  current: string;
  /** Called with a page row's label when it is picked. */
  onNavigate: (label: string) => void;
  onOpenBlocks: () => void;
  /** Blocks is shown but not open yet: a new account before its starting blocks are added. */
  blocksLocked?: boolean | undefined;
  /** Earlier chats with Zebri; a new account has none. Defaults to the demo's. */
  history?: { group: string; items: string[] }[] | undefined;
  /** The signed-in MC's name. Defaults to the demo user's. */
  userName?: string | undefined;
}

/** v2 app sidebar. See {@link DashboardSidebarProps}. */
export function DashboardSidebar({
  collapsed,
  onToggle,
  items,
  current,
  onNavigate,
  onOpenBlocks,
  blocksLocked = false,
  history = HISTORY,
  userName = DEMO_USER.name,
}: DashboardSidebarProps) {
  // Rows added or removed from Blocks fade and scale in or out while the
  // rest glide to their places, rather than the list jumping. The first
  // render does not animate. auto-animate honours reduced motion.
  const [navRef] = useAutoAnimate<HTMLElement>({ duration: 300, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  return (
    // The toggle hangs over the panel's edge, so it lives on this wrapper,
    // outside the panel's clip.
    <div className="relative hidden shrink-0 md:flex">
      <Panel
        as="aside"
        aria-label="Main"
        className={`flex flex-col overflow-hidden p-3 transition-[width] duration-300 ease-in-out motion-reduce:transition-none ${collapsed ? 'w-16' : 'w-60'}`}
      >
        {/* The Z mark's SVG has a white square baked in; multiply drops it out. */}
        <Image src="/zebri-icon.svg" alt="Zebri" width={28} height={28} className="ml-1.5 mt-1 size-7 shrink-0 mix-blend-multiply" />

        <nav ref={navRef} aria-label="Pages" className="mt-6 space-y-0.5">
          {items.map((item) => (
            <SidebarRow
              key={item.label}
              {...item}
              collapsed={collapsed}
              current={item.label === current}
              onNavigate={() => onNavigate(item.label)}
            />
          ))}
        </nav>

        {/* `inert` while collapsed: the rows are faded out, so they must
            not take focus or clicks either. */}
        <section
          aria-label="Recent chats"
          inert={collapsed}
          className={`mt-7 min-h-0 flex-1 overflow-y-auto transition-opacity duration-200 motion-reduce:transition-none ${collapsed ? 'opacity-0' : 'opacity-100 delay-100'}`}
        >
          {history.map(({ group, items }) => (
            <div key={group} className="pb-4">
              <h2 className="whitespace-nowrap px-3 pb-1 type-body text-zebra-500">{group}</h2>
              <ul className="space-y-0.5">
                {items.map((title) => (
                  <li key={title}>
                    <SidebarRow label={title} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <div className="space-y-2 pt-3">
          <SidebarRow {...BLOCKS} collapsed={collapsed} locked={blocksLocked} onClick={onOpenBlocks} />
          <div className="flex items-center gap-3 border-t border-zebra-950/5 pl-1 pt-3">
            <Avatar name={userName} />
            <div inert={collapsed} className={`flex flex-1 items-center gap-1 ${fadeLabel(collapsed)}`}>
              <span className="min-w-0 flex-1 truncate type-label text-zebra-950">{userName}</span>
              <Button variant="ghost" square aria-label="Settings">
                <Settings aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <span className="absolute -right-4 top-1/2 z-10 -translate-y-1/2">
        <Button
          variant="secondary"
          square
          round
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
          ) : (
            <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
          )}
        </Button>
      </span>
    </div>
  );
}
