'use client';

import { Bell, Calendar, Inbox, Blocks, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui-v2/popover';

import { CalendarPanel } from './calendar-panel';
import { ENQUIRIES, EVENTS, NOTIFICATIONS, type CalendarEvent, type Enquiry, type Notification } from './demo-activity';
import { EnquiryPanel } from './enquiry-panel';
import { NotificationPanel } from './notification-panel';
import { useUnread } from './use-unread';

/**
 * Top-right actions: Calendar, Enquiries and Notifications as one
 * switcher. They share a single popover pinned under the right edge of
 * the icon panel, so it never jumps sideways; the open icon holds the
 * active fill, clicking another swaps the content in place with a soft
 * fade (no sliding: the user found side-to-side motion distracting),
 * and clicking the open one, Escape, or outside closes it. Enquiries and
 * Notifications show a grass dot while anything is unread. On phones,
 * where there is no sidebar, a Blocks button leads the row.
 *
 * @module app/design-system/v2/pages/dashboard/top-actions
 */

/** Which panel is open. */
export type TopPanel = 'calendar' | 'enquiries' | 'notifications';
type Tab = TopPanel;
const TABS: { id: Tab; icon: LucideIcon; label: string }[] = [
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'enquiries', icon: Inbox, label: 'Enquiries' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
];

export interface TopActionsProps {
  onOpenBlocks: () => void;
  /** The phone's Blocks button is off: a new account before its starting blocks are added. */
  blocksLocked?: boolean | undefined;
  /**
   * The open panel, when the caller controls it (Home's "new enquiries"
   * count opens Enquiries from outside). Left out, the actions keep it.
   */
  panel?: TopPanel | null | undefined;
  onPanel?: ((panel: TopPanel | null) => void) | undefined;
  /** What the three panels show; the demo business's when left out (a new account passes its own). */
  events?: readonly CalendarEvent[] | undefined;
  enquiries?: readonly Enquiry[] | undefined;
  notifications?: readonly Notification[] | undefined;
}

/** Calendar, enquiries and notifications, top right. See {@link TopActionsProps}. */
export function TopActions({ onOpenBlocks, blocksLocked = false, panel, onPanel, events = EVENTS, enquiries: enquiryItems = ENQUIRIES, notifications: noticeItems = NOTIFICATIONS }: TopActionsProps) {
  const [own, setOwn] = useState<Tab | null>(null);
  const active = panel === undefined ? own : panel;
  const setActive = (next: Tab | null | ((a: Tab | null) => Tab | null)) => {
    const value = typeof next === 'function' ? next(active) : next;
    setOwn(value);
    onPanel?.(value);
  };
  const anchor = useRef<HTMLElement & HTMLDivElement>(null);
  const enquiries = useUnread(enquiryItems);
  const notifications = useUnread(noticeItems);
  const hasNew: Record<Tab, boolean> = {
    calendar: false,
    enquiries: enquiries.unread.size > 0,
    notifications: notifications.unread.size > 0,
  };

  const pick = (id: Tab) => setActive((a) => (a === id ? null : id));

  const icons = (
    <>
      <Button
        variant="ghost"
        square
        aria-label="Blocks"
        aria-haspopup="dialog"
        className="md:hidden"
        disabled={blocksLocked}
        onClick={onOpenBlocks}
      >
        <Blocks aria-hidden="true" strokeWidth={1.5} className="size-4" />
      </Button>
      {TABS.map(({ id, icon: Icon, label }) => (
        <Button
          key={id}
          variant="ghost"
          square
          active={active === id}
          aria-expanded={active === id}
          aria-haspopup="dialog"
          aria-label={hasNew[id] ? `${label}, new` : label}
          // Three bare icons: the hover name saves guessing which is which.
          title={label}
          onClick={() => pick(id)}
        >
          <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
          {hasNew[id] ? (
            // Ringed in white so it reads as a mark on the corner, not a blot on the glyph.
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 size-2 rounded-pill bg-grass-500 ring-2 ring-field"
            />
          ) : null}
        </Button>
      ))}
    </>
  );

  return (
    <Popover open={active !== null} onOpenChange={(open) => (open ? undefined : setActive(null))}>
      <PopoverAnchor asChild>
        {/* 36px tall with its border, the same as every button and field,
            so the icons sit level with a page's toolbar beside them. */}
        <Panel ref={anchor} className="flex items-center gap-0.5 p-0.5 [&>button]:size-[1.875rem]">
          {icons}
        </Panel>
      </PopoverAnchor>
      <PopoverContent
        size="panel"
        align="end"
        aria-label={TABS.find((t) => t.id === active)?.label}
        // Focus the popover itself, not its first control: jumping to
        // Mark all read put a focus ring on it after a mouse click. From
        // here Tab walks through the panel as usual.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
        // The icons sit outside the popover; clicking one switches
        // panels, so it must not count as "outside" and close it.
        onInteractOutside={(e) => {
          if (anchor.current?.contains(e.target as Node)) e.preventDefault();
        }}
        tabIndex={-1}
      >
        {/* Keyed by panel, so each switch mounts fresh and fades in. */}
        <div key={active} className="motion-safe:animate-[fade-in_200ms_ease-out_both]">
          {active === 'calendar' ? <CalendarPanel events={events} /> : null}
          {active === 'enquiries' ? (
            <EnquiryPanel items={enquiryItems} unread={enquiries.unread} onRead={enquiries.read} />
          ) : null}
          {active === 'notifications' ? (
            <NotificationPanel items={noticeItems} unread={notifications.unread} onRead={notifications.read} />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
