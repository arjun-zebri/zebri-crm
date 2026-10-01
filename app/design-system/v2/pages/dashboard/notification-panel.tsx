'use client';

import { CalendarDays, Clock, CreditCard, FileCheck, MessageSquare, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Segmented } from '@/components/ui-v2/segmented';

import { NOTIFICATIONS, type Notification, type NotificationKind } from './demo-activity';
import { PanelFooter, PanelHeader, WhenDot } from './panel-parts';

/**
 * What the Notifications button opens: everything that happened, grouped
 * Today and Earlier, showing unread first (Unread on the left and the
 * default, All beside it), with Mark all read and a way
 * to notification settings. Each item's icon is tinted by what it means:
 * grass for money in and signatures, amber for a deadline, grey for the
 * rest. Read state lives with the caller, so the button's dot stays in step.
 *
 * @module app/design-system/v2/pages/dashboard/notification-panel
 */

export interface NotificationPanelProps {
  /** What to list; the demo's when left out. */
  items?: readonly Notification[] | undefined;
  unread: ReadonlySet<string>;
  /** Mark one read, or all with no id. */
  onRead: (id?: string) => void;
}

const KIND: Record<NotificationKind, { icon: LucideIcon; tint: string }> = {
  payment: { icon: CreditCard, tint: 'bg-grass-100 text-grass-800' },
  signed: { icon: FileCheck, tint: 'bg-grass-100 text-grass-800' },
  booking: { icon: CalendarDays, tint: 'bg-zebra-100 text-zebra-600' },
  comment: { icon: MessageSquare, tint: 'bg-zebra-100 text-zebra-600' },
  deadline: { icon: Clock, tint: 'bg-warning/15 text-warning' },
};

type Filter = 'All' | 'Unread';

/** The notifications popover's content. See {@link NotificationPanelProps}. */
export function NotificationPanel({ items = NOTIFICATIONS, unread, onRead }: NotificationPanelProps) {
  // Unread first and by default: what is new is why the bell was opened.
  const [filter, setFilter] = useState<Filter>('Unread');
  const shown = filter === 'All' ? items : items.filter((n) => unread.has(n.id));
  const groups = [
    { label: 'Today', items: shown.filter((n) => n.today) },
    { label: 'Earlier', items: shown.filter((n) => !n.today) },
  ].filter((g) => g.items.length > 0);
  return (
    <div>
      <section className="space-y-4 p-5 pb-3">
        <PanelHeader title="Notifications" unread={unread.size} onReadAll={() => onRead()} />
        <Segmented label="Show" options={['Unread', 'All'] as const} counts={{ All: items.length, Unread: unread.size }} value={filter} onChange={setFilter} />
        {groups.length === 0 ? (
          <p className="py-6 text-center type-body text-zebra-500">
            {items.length ? "You're all caught up." : 'Nothing yet. When clients open, sign and pay, it lands here.'}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="space-y-1">
              <h3 className="type-body text-zebra-400">{g.label}</h3>
              <ul className="-mx-2">
                {g.items.map((n) => (
                  <Item key={n.id} n={n} isNew={unread.has(n.id)} onOpen={() => onRead(n.id)} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <PanelFooter>
        <Button variant="secondary" className="w-full">
          <SlidersHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
          Notification settings
        </Button>
      </PanelFooter>
    </div>
  );
}

function Item({ n, isNew, onOpen }: { n: Notification; isNew: boolean; onOpen: () => void }) {
  const { icon: Icon, tint } = KIND[n.kind];
  return (
    <li>
      <a
        href="#"
        onClick={onOpen}
        className="flex gap-3 rounded-button p-2 transition-colors duration-150 hover:bg-zebra-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none"
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-pill ${tint}`}>
          <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-start justify-between gap-3">
            <span className="type-body text-zebra-600">
              <span className="type-label text-zebra-950">{n.who}</span> {n.what}
            </span>
            <WhenDot ago={n.ago} unread={isNew} />
          </span>
          <span className="block truncate type-body text-zebra-500">{n.detail}</span>
        </span>
      </a>
    </li>
  );
}
