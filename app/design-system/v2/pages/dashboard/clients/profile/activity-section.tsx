'use client';

import { useState } from 'react';

import { Dropdown } from '@/components/ui-v2/dropdown';
import { EmptyState } from '@/components/ui-v2/empty-state';

import { ActivityDetail } from './activity-detail';
import { ActivityRow } from './activity-row';
import { ExpandRow } from './expand-row';
import type { ActivityKind, Profile } from './profile-data';
import { GUTTER, TOP } from './profile-header';
import { ProfileGroup } from './section-frame';

/**
 * Everything that has happened with the client, newest first under
 * plain headings ("This week", "September"): messages both ways,
 * payments, documents, calls and what Zebri did on its own. One column
 * (2026-10-09 founder mockup): one dropdown picks what to show, when the client
 * was last heard from on the right, a one-line row per thing, and a row
 * opens its full story under itself. The last section in the sidebar:
 * a record to look back on, not where the MC starts.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/activity-section
 */

const FILTERS = ['All', 'Messages', 'Calls', 'Payments', 'Documents'] as const;
type Filter = (typeof FILTERS)[number];

// "All" alone reads oddly as the only word on the line, so the menu says what it is all of.
const OPTIONS = FILTERS.map((f) => ({ value: f, label: f === 'All' ? 'All activity' : f }));

const KIND: Record<Exclude<Filter, 'All'>, ActivityKind> = {
  Messages: 'message',
  Calls: 'call',
  Payments: 'payment',
  Documents: 'document',
};

/** "Jack · 6 days ago" from the glance facts → "Last heard from Jack, 6 days ago". */
function lastHeard(profile: Profile) {
  const fact = profile.glance.find((f) => f.label === 'Last heard from');
  if (!fact) return null;
  const [who, when] = fact.value.split(' · ');
  return when ? `Last heard from ${who}, ${when}` : `Last heard from ${who}`;
}

/** The Activity section. */
export function ActivitySection({ profile }: { profile: Profile }) {
  const [filter, setFilter] = useState<Filter>('All');
  const [open, setOpen] = useState<string | null>(null);
  const groups = profile.activity
    .map((g) => ({
      ...g,
      items: filter === 'All' ? g.items : g.items.filter((a) => a.kind === KIND[filter]),
    }))
    .filter((g) => g.items.length);
  const heard = lastHeard(profile);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto motion-safe:animate-fade-in">
      <div className={`space-y-8 pb-28 ${TOP} ${GUTTER}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* -ml-1.5 takes back the trigger's padding, so its text lines up with the name above. */}
          <div className="-ml-1.5 mr-auto">
            <Dropdown
              inline
              label="Show"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={OPTIONS}
            />
          </div>
          {heard ? <p className="type-body text-zebra-500">{heard}</p> : null}
        </div>
        {groups.length ? (
          groups.map(({ title, items }) => (
            <ProfileGroup key={title} title={title}>
              <ul className="-mx-3">
                {items.map((a) => (
                  <ExpandRow
                    key={a.id}
                    open={open === a.id}
                    onToggle={() => setOpen(open === a.id ? null : a.id)}
                    detail={<ActivityDetail item={a} />}
                  >
                    <ActivityRow item={a} />
                  </ExpandRow>
                ))}
              </ul>
            </ProfileGroup>
          ))
        ) : (
          <EmptyState compact title="Nothing here yet" body="What you and they do shows here as it happens." />
        )}
      </div>
    </div>
  );
}
