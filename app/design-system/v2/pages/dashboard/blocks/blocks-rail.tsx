import { Button } from '@/components/ui-v2/button';
import { BlocksIcon, BriefcaseIcon, CircleCheckIcon, EnquiriesIcon, PaymentsIcon, SearchIcon, WeddingDayIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { Input } from '@/components/ui-v2/input';

import { CATEGORIES } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * The Blocks dialog's left rail, kept to the minimum: the title, a grey
 * search well, the views as sidebar rows with their icons and no counts,
 * and one plan line at the foot. A 224px zebra-50 rail beside the white
 * list, set off by a hairline. On phones the rail stacks above the list,
 * the views scroll sideways and the plan line is dropped.
 *
 * An earlier rail (288px, subtitle, role dropdown, counts, a Categories
 * label, a boxed plan card) was rejected as cluttered.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/blocks-rail
 */

/** What the list shows: everything, what is added, or one category. */
export const VIEWS = ['All', 'Added', ...CATEGORIES] as const;
export type View = (typeof VIEWS)[number];

/** Each view's glyph, as the app sidebar gives its rows one. */
const VIEW_ICONS: Record<View, ZebriIcon> = {
  All: BlocksIcon,
  Added: CircleCheckIcon,
  'Win clients': EnquiriesIcon,
  'Book and get paid': PaymentsIcon,
  'Plan the event': WeddingDayIcon,
  'Run your business': BriefcaseIcon,
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
    <div className="flex shrink-0 flex-col gap-4 border-b border-hairline bg-zebra-50 p-5 md:w-56 md:overflow-y-auto md:border-b-0 md:border-r">
      {/* Clear of the close button, which sits over this corner on phones. */}
      <h2 id="blocks-title" className="px-3 pr-10 pt-2 type-subheading text-zebra-950 md:pr-3">
        Blocks
      </h2>
      <Input
        // Text, not `search`: the native clear button is a blue X off the palette.
        type="text"
        enterKeyHint="search"
        data-autofocus
        filled
        aria-label="Search blocks"
        placeholder="Search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        leading={<SearchIcon aria-hidden="true" className="size-4" />}
      />
      {/* Like the app sidebar: the two views, a gap, then the categories.
          On phones one sideways-scrolling row. */}
      <nav aria-label="Show" className="-mx-4 flex gap-0.5 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
        {VIEWS.map((v, i) => (
          <ViewRow key={v} view={v} on={v === view} gapBefore={i === 2} onClick={() => onView(v)} />
        ))}
      </nav>
      <p className="mt-auto hidden items-center justify-between pl-3 type-body text-zebra-500 md:flex">
        {blocks.plan === 'pro' ? 'Pro' : 'Max'} plan
        <Button variant="plain">Compare</Button>
      </p>
    </div>
  );
}

/** One view, a sidebar row: its glyph and name; the current one takes the pressed fill. */
function ViewRow({ view, on, gapBefore, onClick }: { view: View; on: boolean; gapBefore: boolean; onClick: () => void }) {
  const Icon = VIEW_ICONS[view];
  return (
    <button
      type="button"
      aria-current={on ? 'true' : undefined}
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-button px-3 type-body transition-colors duration-150 focus-mark motion-reduce:transition-none ${
        gapBefore ? 'md:mt-4' : ''
      } ${on ? 'bg-pressed text-zebra-950' : 'text-zebra-600 hover:bg-hover hover:text-zebra-950'}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {view}
    </button>
  );
}
