import type { Event, TimelineItem } from '@/types/event';

/**
 * Static demo data for the showroom.
 *
 * Shapes mirror what the real `queryFn`s return, including the nested
 * relations PostgREST embeds (`contact:contact_id(...)`), so seeded
 * composites render the same branches they would with live data.
 *
 * Dates are hard-coded rather than derived from `new Date()` so the
 * showroom renders identically on every visit.
 *
 * @module app/design-system/fixtures
 */

/** The event id every seeded event composite is keyed on. */
export const DEMO_EVENT_ID = 'design-system-demo-event';

/** The couple id used by couple-scoped demos. */
export const DEMO_COUPLE_ID = 'design-system-demo-couple';

const CREATED_AT = '2027-01-04T00:00:00.000Z';

/** A demo event, shaped like a row from `events`. */
export const DEMO_EVENT: Event = {
  id: DEMO_EVENT_ID,
  user_id: 'design-system-demo-user',
  couple_id: DEMO_COUPLE_ID,
  date: '2027-03-14',
  title: 'Wedding reception',
  venue: 'The Boathouse, Balmoral',
  venue_phone: '+61 2 9969 5050',
  venue_website: 'https://example.com',
  timeline_notes: 'Guests arrive from 4pm. Sunset photos at 6:20pm.',
  status: 'upcoming',
  share_token: 'demo-share-token',
  share_token_enabled: true,
  created_at: CREATED_AT,
  couple: { id: DEMO_COUPLE_ID, name: 'Alex and Sam', status: 'booked' },
};

const timelineItem = (
  n: number,
  start: string,
  title: string,
  duration: number,
  contact: TimelineItem['contact'] = null,
): TimelineItem => ({
  id: `demo-timeline-${n}`,
  event_id: DEMO_EVENT_ID,
  user_id: DEMO_EVENT.user_id,
  start_time: start,
  title,
  description: null,
  duration_min: duration,
  contact_id: contact?.id ?? null,
  position: n,
  created_at: CREATED_AT,
  contact,
});

/** Every fixture the seeded query cache serves. */
export const FIXTURES = {
  timelineItems: [
    timelineItem(1, '16:00', 'Guests arrive', 30),
    timelineItem(2, '16:30', 'Ceremony', 30, {
      id: 'demo-contact-1',
      name: 'Jordan Reid',
      category: 'celebrant',
    }),
    timelineItem(3, '17:00', 'Canapes and photos', 60, {
      id: 'demo-contact-2',
      name: 'Casey Nguyen',
      category: 'photographer',
    }),
    timelineItem(4, '18:30', 'Speeches', 45),
    timelineItem(5, '20:00', 'First dance', 15, {
      id: 'demo-contact-3',
      name: 'Sam Doyle',
      category: 'dj',
    }),
  ] satisfies TimelineItem[],

  eventShare: { share_token: 'demo-share-token', share_token_enabled: true },

  tasks: [
    {
      id: 'demo-task-1',
      title: 'Send the run sheet to the venue',
      due_date: '2027-03-01',
      description: null,
      status: 'todo',
      related_couple_id: DEMO_COUPLE_ID,
      group_id: null,
      position: 1,
      priority: 'high',
      task_type: null,
    },
    {
      id: 'demo-task-2',
      title: 'Confirm the DJ arrival time',
      due_date: '2027-03-08',
      description: null,
      status: 'done',
      related_couple_id: DEMO_COUPLE_ID,
      group_id: null,
      position: 2,
      priority: null,
      task_type: null,
    },
  ],

  eventContacts: [
    {
      id: 'demo-link-1',
      contact_id: 'demo-contact-1',
      vendor: { id: 'demo-contact-1', name: 'Jordan Reid', category: 'celebrant', status: 'confirmed' },
    },
    {
      id: 'demo-link-2',
      contact_id: 'demo-contact-2',
      vendor: { id: 'demo-contact-2', name: 'Casey Nguyen', category: 'photographer', status: 'contacted' },
    },
  ],

  couples: [
    { id: DEMO_COUPLE_ID, name: 'Alex and Sam', primary_email: 'alex@example.com', email: 'alex@example.com' },
    { id: 'demo-couple-2', name: 'Priya and Jo', primary_email: 'priya@example.com', email: 'priya@example.com' },
  ],

  contractTemplates: [
    { id: 'demo-template-1', name: 'Standard MC agreement', description: 'The default booking contract.' },
  ],

  /** `useApplySources` returns `{ options, applyMap }`. Empty is valid. */
  applySources: { options: [], applyMap: {} },

  timeCategories: [
    { id: 'demo-cat-1', name: 'Planning call', position: 1, color: '#7C3AED' },
    { id: 'demo-cat-2', name: 'Run sheet prep', position: 2, color: '#059669' },
    { id: 'demo-cat-3', name: 'Travel', position: 3, color: null },
  ],
} as const;
