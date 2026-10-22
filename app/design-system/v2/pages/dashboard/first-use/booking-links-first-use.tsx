'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CalendarClockIcon, ClockIcon, VideoIcon } from '@/components/ui-v2/icons';

import { CalendarRows } from '../calendar/settings/calendar-rows';
import { useCalendarSync } from '../calendar/use-calendar-sync';
import { PageBar } from '../page-bar';
import { PageFrame } from '../page-frame';

import { ZebriSays } from './zebri-says';

/**
 * Booking links on a new account: a block that needs a connection
 * before it can do anything, so the page is that one step and nothing
 * else (connect a calendar, and why), not a tour of a page that cannot
 * work yet. The connect rows are Settings' own (`CalendarRows`: one
 * pattern and one mark per brand wherever a calendar is connected), on
 * the shared calendar store, so a calendar connected here is connected
 * everywhere. Connecting draws a tick, then Zebri hands over the intro
 * call link, already made, ready to copy. Demo: nothing connects.
 *
 * @module app/design-system/v2/pages/dashboard/first-use/booking-links-first-use
 */

const LINK = 'zebri.com/book/intro-call';

const NAMES = { google: 'Google Calendar', outlook: 'Outlook' } as const;

/** The Booking links page on a new account. */
export function BookingLinksFirstUse({ heading: Heading, actions }: { heading: 'h1' | 'h2'; actions?: ReactNode }) {
  const sync = useCalendarSync();
  const first = [...sync.connected][0];
  const connected = first ? NAMES[first] : null;
  return (
    <PageFrame
      labelledBy="booking-title"
      bar={
        <PageBar
          title={
            <Heading id="booking-title" className="sr-only">
              Booking links
            </Heading>
          }
          actions={actions}
        />
      }
    >
      {connected ? (
        <div className="max-w-2xl space-y-10">
          <div className="flex items-center gap-3 motion-safe:animate-rise-in">
            <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-pill bg-selected text-field">
              <DrawnCheck className="size-4" />
            </span>
            <p className="type-label text-zebra-950">{connected} connected</p>
          </div>
          <ZebriSays text="Your intro call link is ready. Send the link to your next enquiry and they'll pick a time you're free.">
            <div className="flex flex-wrap items-center gap-3">
              <span className="type-body text-zebra-500">{LINK}</span>
              <CopyButton value={`https://${LINK}`} />
            </div>
          </ZebriSays>
          <div className="space-y-3">
            <GroupLabel as="h2">Your booking links</GroupLabel>
            <div className="flex items-center gap-3">
              <IconCircle icon={CalendarClockIcon} />
              <span className="min-w-0 flex-1">
                <span className="block type-label text-zebra-950">Intro call</span>
                <span className="flex flex-wrap items-center gap-x-3 type-body text-zebra-500">
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon aria-hidden="true" className="size-3.5" />
                    15 min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <VideoIcon aria-hidden="true" className="size-3.5" />
                    Video link added for you
                  </span>
                </span>
              </span>
              <Button variant="secondary">Edit</Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={CalendarClockIcon}
          title="Connect your calendar"
          body="Couples only see times you're free, so nobody books over an event. One step, then your intro call link is ready."
          action={
            <div className="w-80 max-w-full text-left">
              <CalendarRows />
            </div>
          }
        />
      )}
    </PageFrame>
  );
}
