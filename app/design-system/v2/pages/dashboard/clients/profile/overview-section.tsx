import { OverviewDetails } from './overview-details';
import type { Profile, Task } from './profile-data';
import { SplitSection } from './split-section';
import { Timeline } from './timeline';

/**
 * The Overview: the timeline from today to the event on the left, the
 * client's details on the right. The timeline fills its column's height,
 * so from `lg` the event sits at the bottom.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/overview-section
 */

export interface OverviewSectionProps {
  profile: Profile;
  /** Today's tasks still open (sent ones drop off). */
  tasks: Task[];
  /** "in 15 days", or empty. */
  countdown: string;
  /** Opens the task's drafted message. */
  onTask: (task: Task) => void;
}

/** The Overview section. See {@link OverviewSectionProps}. */
export function OverviewSection({ profile, tasks, countdown, onTask }: OverviewSectionProps) {
  return (
    <SplitSection
      asideLabel="Details"
      main={
        <Timeline
          tasks={tasks}
          upcoming={profile.upcoming}
          event={profile.event}
          countdown={countdown}
          onTask={onTask}
        />
      }
      aside={
        <OverviewDetails facts={profile.facts} people={profile.people} notes={profile.notes} />
      }
    />
  );
}
