'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { BlocksIcon, CalendarIcon, EnquiriesIcon, NotificationsIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { Panel } from '@/components/ui-v2/panel';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui-v2/popover';

import { useBdmNotices, useBdmOn } from './bdm/bdm-store';
import { EVENTS, type CalendarEvent } from './calendar/calendar-data';
import { CalendarPanel } from './calendar/calendar-panel';
import { ENQUIRIES, NOTIFICATIONS, type Enquiry, type Notification } from './demo-activity';
import { EnquiryModals } from './enquiries/enquiry-modals';
import { useEnquiriesConfigured } from './enquiries/settings/use-enquiry-settings';
import { useEnquiries } from './enquiries/use-enquiries';
import { EnquiryPanel } from './enquiry-panel';
import { NotificationPanel } from './notification-panel';
import { openSettings } from './settings/settings-store';
import { useUnread } from './use-unread';

/**
 * Top-right actions: Calendar, Enquiries and Notifications as one
 * switcher. They share a single popover pinned under the right edge of
 * the icon panel, so it never jumps sideways; the open icon holds the
 * active fill, clicking another swaps the content in place with a soft
 * fade (no sliding: the user found side-to-side motion distracting),
 * and clicking the open one, Escape, or outside closes it. Enquiries and
 * Notifications show a grass dot while anything is unread. On phones,
 * where there is no sidebar, a Blocks button leads the row. An enquiry
 * row opens the enquiry modal and the panel's foot opens Settings on
 * its Enquiries tab; both close the popover and open as dialogs over the page.
 *
 * @module app/design-system/v2/pages/dashboard/top-actions
 */

/** Which panel is open. */
export type TopPanel = 'calendar' | 'enquiries' | 'notifications';
type Tab = TopPanel;
const TABS: { id: Tab; icon: ZebriIcon; label: string }[] = [
  { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
  { id: 'enquiries', icon: EnquiriesIcon, label: 'Enquiries' },
  { id: 'notifications', icon: NotificationsIcon, label: 'Notifications' },
];

export interface TopActionsProps {
  onOpenBlocks: () => void;
  /** The phone's Blocks button is off: a new account before its starting blocks are added. */
  blocksLocked?: boolean | undefined;
  /**
   * The Enquiries block is not added yet: its icon is left out of the
   * row altogether (user ruling), and its panel never opens.
   */
  enquiriesLocked?: boolean | undefined;
  /**
   * The Calendar block is not added yet: its icon is left out of the row
   * (user ruling, as for Enquiries), and its panel never opens.
   */
  calendarLocked?: boolean | undefined;
  /** The Booking links block is added: the calendar ends on the booking types. */
  bookingTypes?: boolean | undefined;
  /** Opens a client's profile from one of their calendar items; the popover closes first. */
  onOpenClient?: ((id: string) => void) | undefined;
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
export function TopActions({
  onOpenBlocks,
  blocksLocked = false,
  enquiriesLocked = false,
  calendarLocked = false,
  bookingTypes = false,
  onOpenClient,
  panel,
  onPanel,
  events = EVENTS,
  enquiries: enquiryItems = ENQUIRIES,
  notifications: noticeItems = NOTIFICATIONS,
}: TopActionsProps) {
  const [own, setOwn] = useState<Tab | null>(null);
  const chosen = panel === undefined ? own : panel;
  // A locked panel never shows, even when Home's count asks for it.
  const locked: Record<Tab, boolean> = {
    calendar: calendarLocked,
    enquiries: enquiriesLocked,
    notifications: false,
  };
  const active = chosen && locked[chosen] ? null : chosen;
  const setActive = (next: Tab | null | ((a: Tab | null) => Tab | null)) => {
    const value = typeof next === 'function' ? next(active) : next;
    setOwn(value);
    onPanel?.(value);
  };
  const anchor = useRef<HTMLElement & HTMLDivElement>(null);
  const enq = useEnquiries();
  // Nothing comes in until a source is set up, so an unconfigured block lists nothing.
  const configured = useEnquiriesConfigured();
  const listed = configured ? enquiryItems.filter((e) => !enq.archived.has(e.id)) : [];
  const enquiries = useUnread(listed);
  // What the Registry said about a lodgement comes first, while the Lodge with BDM block is added.
  const bdmNotices = useBdmNotices();
  const bdmOn = useBdmOn();
  const notices = bdmOn && bdmNotices.length ? [...bdmNotices, ...noticeItems] : noticeItems;
  const notifications = useUnread(notices);
  const hasNew: Record<Tab, boolean> = {
    calendar: false,
    enquiries: !enquiriesLocked && enquiries.unread.size > 0,
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
        className="md:hidden shot:hidden"
        disabled={blocksLocked}
        onClick={onOpenBlocks}
      >
        <BlocksIcon aria-hidden="true" className="size-4" />
      </Button>
      {TABS.filter((t) => !locked[t.id]).map(({ id, icon: Icon, label }) => (
        <Button
          key={id}
          variant="ghost"
          square
          active={active === id}
          aria-expanded={active === id}
          aria-haspopup="dialog"
          aria-label={hasNew[id] ? `${label}, new` : label}
          // A trick on a new account's Home rings these (`first-run/tricks.ts`).
          data-tour={id}
          // No tooltip (user, 2026-10-16): the calendar and bell say what they are.
          tooltip={false}
          onClick={() => pick(id)}
        >
          <Icon aria-hidden="true" className="size-4" />
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
    <>
      <Popover open={active !== null} onOpenChange={(open) => (open ? undefined : setActive(null))}>
        <PopoverAnchor asChild>
          {/* 36px tall with its border, the same as every button and field,
            so the icons sit level with a page's toolbar beside them. */}
          <Panel
            ref={anchor}
            className="flex items-center gap-0.5 p-0.5 [&>button]:size-[1.875rem]"
          >
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
          <div key={active} className="motion-safe:animate-fade-in">
            {active === 'calendar' ? (
              <CalendarPanel
                events={events}
                bookingTypes={bookingTypes}
                onLeave={() => setActive(null)}
                onOpenClient={
                  onOpenClient
                    ? (id) => {
                        setActive(null);
                        onOpenClient(id);
                      }
                    : undefined
                }
              />
            ) : null}
            {active === 'enquiries' ? (
              <EnquiryPanel
                items={listed}
                unread={enquiries.unread}
                replied={enq.replied}
                configured={configured}
                onRead={enquiries.read}
                onOpen={(id) => {
                  setActive(null);
                  enq.setOpen(id);
                }}
                onSettings={() => {
                  setActive(null);
                  openSettings('enquiries');
                }}
              />
            ) : null}
            {active === 'notifications' ? (
              <NotificationPanel
                items={notices}
                unread={notifications.unread}
                onRead={notifications.read}
              />
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <EnquiryModals items={listed} state={enq} />
    </>
  );
}
