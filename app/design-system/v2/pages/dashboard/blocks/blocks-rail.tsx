import { CalendarDays, CircleCheck, Handshake, LayoutGrid, Plug, Search, Wallet, type LucideIcon } from 'lucide-react';

import { Input } from '@/components/ui-v2/input';
import { TextLink } from '@/components/ui-v2/text-link';

import { CATEGORIES } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * The Blocks dialog's left rail, kept to the minimum: the title, a
 * search, the views as sidebar rows (icon and name, no counts), and one
 * plan line at the foot. The role picker lives in the suggestion banner,
 * not here. On phones the rail stacks above the list, the views scroll
 * sideways and the plan line is dropped.
 *
 * An earlier rail (288px, subtitle, role dropdown, counts, a Categories
 * label, a boxed plan card) was rejected as cluttered.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/blocks-rail
 */

/** What the list shows: everything, what is added, or one category. */
export const VIEWS = ['All', 'Added', ...CATEGORIES] as const;
export type View = (typeof VIEWS)[number];

const ICONS: Record<View, LucideIcon> = {
  All: LayoutGrid,
  Added: CircleCheck,
  Sell: Handshake,
  Plan: CalendarDays,
  'Get paid': Wallet,
  Connect: Plug,
};

export interface BlocksRailProps {
  query: string;
  onQuery: (query: string) => void;
  view: View;
  onView: (view: View) => void;
  blocks: BlocksState;
}

/** The left rail. See {@link BlocksRailProps}. */
export function BlocksRail({ query, onQuery, view, onView, blocks }: BlocksRailProps) {
  return (
    <div className="flex shrink-0 flex-col gap-4 border-b border-zebra-950/5 bg-zebra-50 p-4 md:w-56 md:overflow-y-auto md:border-b-0 md:border-r">
      {/* Clear of the close button, which sits over this corner on phones. */}
      <h2 id="blocks-title" className="px-1 pr-10 pt-1 type-subheading text-zebra-950 md:pr-1">Blocks</h2>
      <Input
        // Text, not `search`: the native clear button is a blue X off the palette.
        type="text"
        enterKeyHint="search"
        data-autofocus
        aria-label="Search blocks"
        placeholder="Search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        leading={<Search strokeWidth={1.5} className="size-4" />}
      />
      {/* Like the app sidebar: the two views, a gap, then the categories.
          On phones one sideways-scrolling row. */}
      <nav aria-label="Show" className="-mx-4 flex gap-0.5 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
        {VIEWS.map((v, i) => (
          <ViewRow key={v} view={v} on={v === view} gapBefore={i === 2} onClick={() => onView(v)} />
        ))}
      </nav>
      <p className="mt-auto hidden items-center justify-between px-1 type-body text-zebra-500 md:flex">
        {blocks.plan === 'pro' ? 'Pro' : 'Max'} plan
        <TextLink href="#">Compare</TextLink>
      </p>
    </div>
  );
}

/**
 * One view, styled as a sidebar row. The current one takes the
 * sidebar's quiet tint rather than a raised card with a shadow.
 */
function ViewRow({ view, on, gapBefore, onClick }: { view: View; on: boolean; gapBefore: boolean; onClick: () => void }) {
  const Icon = ICONS[view];
  return (
    <button
      type="button"
      aria-current={on ? 'true' : undefined}
      onClick={onClick}
      className={`group flex h-9 shrink-0 items-center gap-3 whitespace-nowrap rounded-button px-3 type-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
        gapBefore ? 'md:mt-4' : ''
      } ${on ? 'bg-zebra-950/5 font-medium text-zebra-950' : 'text-zebra-600 hover:bg-zebra-950/5 hover:text-zebra-950'}`}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className={`size-4 shrink-0 ${on ? 'text-zebra-950' : 'text-zebra-400 group-hover:text-zebra-600'}`} />
      {view}
    </button>
  );
}
