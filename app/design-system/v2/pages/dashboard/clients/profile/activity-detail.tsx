import { Button } from '@/components/ui-v2/button';

import type { Activity } from './profile-data';

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
