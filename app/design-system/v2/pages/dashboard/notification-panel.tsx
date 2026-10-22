'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ROW } from '@/components/ui-v2/control-styles';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { BdmIcon, CalendarIcon, ClockIcon, FileCheckIcon, MessageIcon, PaymentsIcon, SettingsIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { Segmented } from '@/components/ui-v2/segmented';

import { NOTIFICATIONS, type Notification, type NotificationKind } from './demo-activity';
import { PanelFooter, PanelHeader, WhenDot } from './panel-parts';

/**
 * What the Notifications button opens: everything that happened, grouped
 * Today and Earlier, showing unread first (Unread on the left and the
 * default, All beside it), with Mark all read and a way
 * to Settings. Each item's icon is tinted by what it means:
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

// A `tone` only where the kind means something (money in, a signature, a
// deadline); the rest take the neutral `IconCircle`, as every other icon
// circle in v2 does.
const KIND: Record<NotificationKind, { icon: ZebriIcon; tone?: 'grass' | 'warning' }> = {
  payment: { icon: PaymentsIcon, tone: 'grass' },
  signed: { icon: FileCheckIcon, tone: 'grass' },
  booking: { icon: CalendarIcon },
  comment: { icon: MessageIcon },
  deadline: { icon: ClockIcon, tone: 'warning' },
  // The Registry answering on a lodgement: good news, like a signature.
  registry: { icon: BdmIcon, tone: 'grass' },
};

type Filter = 'All' | 'Unread';

/** The notifications popover's content. See {@link NotificationPanelProps}. */
export function NotificationPanel({
  items = NOTIFICATIONS,
  unread,
  onRead,
}: NotificationPanelProps) {
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
        <PanelHeader
          title="Notifications"
          unread={unread.size}
          onReadAll={() => onRead()}
          empty={groups.length === 0}
        />
        <Segmented
          label="Show"
          options={['Unread', 'All'] as const}
          counts={{ All: items.length, Unread: unread.size }}
          value={filter}
          onChange={setFilter}
        />
        {groups.length === 0 ? (
          // Left-aligned, with a little room, like the Enquiries panel's empty line.
          <p className="py-3 text-pretty type-body text-zebra-500">
            {items.length
              ? "You're all caught up."
              : 'Nothing yet. When clients open, sign and pay, it lands here.'}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="space-y-1">
              <GroupLabel as="h3" id={`notices-${g.label}`}>
                {g.label}
              </GroupLabel>
              <ul aria-labelledby={`notices-${g.label}`} className="-mx-2">
                {g.items.map((n) => (
                  <Item key={n.id} n={n} isNew={unread.has(n.id)} onOpen={() => onRead(n.id)} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <PanelFooter>
        <Button variant="secondary" className="w-full" icon={<SettingsIcon aria-hidden="true" className="size-4" />}>
          Settings
        </Button>
      </PanelFooter>
    </div>
  );
}

function Item({ n, isNew, onOpen }: { n: Notification; isNew: boolean; onOpen: () => void }) {
  const { icon: Icon, tone } = KIND[n.kind];
  return (
    <li>
      {/* A button, as every other row: a link to # rewrote the route's hash. */}
      <button type="button" onClick={onOpen} className={`flex w-full gap-3 rounded-button p-2 text-left ${ROW}`}>
        <IconCircle icon={Icon} tone={tone} />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-start justify-between gap-3">
            <span className="type-body text-zebra-600">
              <span className="type-label text-zebra-950">{n.who}</span> {n.what}
            </span>
            <WhenDot ago={n.ago} unread={isNew} />
          </span>
          <span className="block truncate type-body text-zebra-500">{n.detail}</span>
        </span>
      </button>
    </li>
  );
}
