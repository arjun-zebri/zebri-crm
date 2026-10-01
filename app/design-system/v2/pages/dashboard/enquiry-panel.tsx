'use client';

import { Globe, Instagram, Mail, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { Segmented } from '@/components/ui-v2/segmented';

import { ENQUIRIES, type Enquiry, type EnquirySource } from './demo-activity';
import { PanelFooter, PanelHeader, WhenDot } from './panel-parts';

/**
 * What the Enquiries button opens: every new enquiry with its date,
 * guest count, the start of their message and where it came from, a
 * filter by source, Mark all read, and a way through to the full list.
 * Read state lives with the caller, so the button's count stays in step.
 *
 * @module app/design-system/v2/pages/dashboard/enquiry-panel
 */

export interface EnquiryPanelProps {
  /** What to list; the demo's when left out. */
  items?: readonly Enquiry[] | undefined;
  /** Ids still unread. */
  unread: ReadonlySet<string>;
  /** Mark one enquiry read, or all of them with no id. */
  onRead: (id?: string) => void;
}

type Filter = 'All' | EnquirySource;
const FILTERS: Filter[] = ['All', 'Email', 'Instagram', 'Website'];
const SOURCE_ICON: Record<EnquirySource, LucideIcon> = { Email: Mail, Instagram, Website: Globe };
const SOURCE_LABEL: Record<EnquirySource, string> = { Email: 'Email', Instagram: 'Instagram', Website: 'Website form' };

/** The enquiries popover's content. See {@link EnquiryPanelProps}. */
export function EnquiryPanel({ items = ENQUIRIES, unread, onRead }: EnquiryPanelProps) {
  const [filter, setFilter] = useState<Filter>('All');
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === 'All' ? items.length : items.filter((e) => e.source === f).length]));
  const shown = filter === 'All' ? items : items.filter((e) => e.source === filter);
  return (
    <div>
      <section className="space-y-4 p-5 pb-3">
        <PanelHeader title="Enquiries" unread={unread.size} onReadAll={() => onRead()} />
        <Segmented label="Filter by source" options={FILTERS} counts={counts} value={filter} onChange={setFilter} />
        {items.length === 0 ? (
          <p className="py-6 text-center type-body text-zebra-500">
            No enquiries yet. They land here from your email and your website form.
          </p>
        ) : null}
        <ul className="-mx-2">
          {shown.map((e) => {
            const Icon = SOURCE_ICON[e.source];
            const isNew = unread.has(e.id);
            return (
              <li key={e.id}>
                <a
                  href="#"
                  onClick={() => onRead(e.id)}
                  className="flex gap-3 rounded-button p-2 transition-colors duration-150 hover:bg-zebra-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none"
                >
                  <Avatar name={e.client.replace(' & ', ' ')} tone="muted" />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="flex w-full items-baseline justify-between gap-3">
                      <span className="truncate type-label text-zebra-950">{e.client}</span>
                      <WhenDot ago={e.ago} unread={isNew} />
                    </span>
                    <span className="type-body text-zebra-500">
                      {e.date} · {e.guests} guests
                    </span>
                    <span className="w-full truncate type-body text-zebra-700">{e.message}</span>
                    <Badge>
                      <Icon aria-hidden="true" strokeWidth={1.5} className="mr-1.5 size-3.5" />
                      {SOURCE_LABEL[e.source]}
                    </Badge>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      <PanelFooter>
        <Button className="w-full">View all enquiries</Button>
      </PanelFooter>
    </div>
  );
}
