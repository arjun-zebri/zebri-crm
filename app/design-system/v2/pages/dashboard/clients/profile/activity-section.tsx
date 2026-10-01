'use client';

import { useState } from 'react';

import { ActivityDetail, Glance } from './activity-detail';
import { ActivityRow } from './activity-row';
import { FilterPills } from './filter-pills';
import type { ActivityKind, Profile } from './profile-data';
import { ProfileGroup } from './section-frame';
import { SelectRow } from './select-row';
import { SplitSection } from './split-section';

/**
 * Everything that has happened with the client, newest first under
 * plain headings ("This week", "March"): messages both ways, payments,
 * documents and what Zebri did on its own. Pills filter the list; the
 * selected item shows in full in the panel on the right, above "At a
 * glance". Replaces the current app's Emails tab and the workflow feed.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/activity-section
 */

const FILTERS = ['All', 'Messages', 'Calls', 'Payments', 'Documents', 'Zebri'] as const;
type Filter = (typeof FILTERS)[number];

const KIND: Record<Exclude<Filter, 'All'>, ActivityKind> = {
  Messages: 'message',
  Calls: 'call',
  Payments: 'payment',
  Documents: 'document',
  Zebri: 'zebri',
};

/** The Activity section. */
export function ActivitySection({ profile }: { profile: Profile }) {
  const [filter, setFilter] = useState<Filter>('All');
  const [picked, setPicked] = useState(profile.activity[0]?.items[0]?.id);
  const groups = profile.activity
    .map((g) => ({
      ...g,
      items: filter === 'All' ? g.items : g.items.filter((a) => a.kind === KIND[filter]),
    }))
    .filter((g) => g.items.length);
  // A filter can hide the selected item; the panel then shows the first one left.
  const shown = groups.flatMap((g) => g.items);
  const current = shown.find((a) => a.id === picked) ?? shown[0];
  return (
    <SplitSection
      asideLabel="Activity details"
      main={
        <div className="max-w-3xl space-y-8">
          <FilterPills label="Show" options={FILTERS} value={filter} onChange={setFilter} />
          {groups.length ? (
            groups.map(({ title, items }) => (
              <ProfileGroup key={title} title={title}>
                <ul className="-mx-3 space-y-1">
                  {items.map((a) => (
                    <SelectRow
                      key={a.id}
                      selected={a === current}
                      onSelect={() => setPicked(a.id)}
                      detail={<ActivityDetail item={a} />}
                    >
                      <ActivityRow item={a} />
                    </SelectRow>
                  ))}
                </ul>
              </ProfileGroup>
            ))
          ) : (
            <p className="py-10 text-center type-body text-zebra-400">Nothing here yet.</p>
          )}
        </div>
      }
      aside={
        <div className="space-y-8">
          {/* Beside the list from lg; below that it opens under the row. */}
          {current ? (
            <div className="hidden border-b border-zebra-200 pb-8 lg:block">
              <ActivityDetail item={current} />
            </div>
          ) : null}
          <Glance facts={profile.glance} />
        </div>
      }
    />
  );
}
