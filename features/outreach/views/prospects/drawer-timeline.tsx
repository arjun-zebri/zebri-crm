/**
 * The History tab of the prospect modal: the full timeline, newest first, in plain English. Each row
 * is one stored event run through {@link describeEvent}. Long histories
 * show the latest 25 and expand on request.
 *
 * @module features/outreach/views/prospects/drawer-timeline
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { OutreachEvent } from '@/lib/outreach/types';

import { describeEvent } from './describe-event';
import { formatRelative, formatSydneyDateTime } from './labels';

const PREVIEW = 25;

/** Props for {@link TimelineSection}. */
export interface TimelineSectionProps {
  events: OutreachEvent[];
}

/** The prospect's event history. */
export function TimelineSection({ events }: TimelineSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? events : events.slice(0, PREVIEW);
  return (
    <>
      {events.length === 0 ? (
        <p className="text-body text-text-muted">Nothing has happened yet.</p>
      ) : (
        <>
          <ol className="space-y-3">
            {shown.map((event) => (
              <li key={event.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-body">
                <span className="min-w-0 break-words text-text">{describeEvent(event)}</span>
                <time dateTime={event.occurred_at} title={formatSydneyDateTime(event.occurred_at)} className="text-text-subtle whitespace-nowrap">
                  {formatRelative(event.occurred_at)}
                </time>
              </li>
            ))}
          </ol>
          {events.length > PREVIEW && (
            <Button variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : `Show all ${events.length}`}
            </Button>
          )}
        </>
      )}
    </>
  );
}
