import { Button } from '@/components/ui-v2/button';

import type { Activity, Fact } from './profile-data';

/**
 * The Activity panel's two parts: the selected item in full (what kind
 * of thing and when, a title, the whole message or what happens next,
 * and the one thing to do about it), and "At a glance", how the client
 * talks to the MC: who was heard from last and how fast each replies.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/activity-detail
 */

/** The selected activity in full. */
export function ActivityDetail({ item }: { item: Activity }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="type-body text-zebra-500">{item.about}</p>
        {/* Below lg this opens under its own row, which already says it. */}
        <h3 className="hidden type-subheading text-zebra-950 lg:block">{item.title}</h3>
      </div>
      <p className="type-body text-zebra-700">{item.body}</p>
      {item.action ? <Button>{item.action}</Button> : null}
    </div>
  );
}

/** "At a glance": label and value rows about how the client talks to the MC. */
export function Glance({ facts }: { facts: Fact[] }) {
  return (
    <section aria-label="At a glance" className="space-y-4">
      <h3 className="type-body text-zebra-500">At a glance</h3>
      <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-3.5 type-body">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-zebra-500">{f.label}</dt>
            <dd className="text-zebra-950">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
