/**
 * Sample run-sheet data shared by the branding editor's run-sheet body
 * placeholder and the branding preview page. Generic wedding timeline content —
 * never sent; the real run sheet is the couple's live event timeline. A single
 * source keeps the editor mock and the preview showing the same thing, both
 * rendered through the real `VendorTimeline` component so they stay faithful.
 *
 * @module app/(dashboard)/branding/blocks/sample-run-sheet
 */
import type { VendorEvent, VendorTimelineItem } from '@/app/portal/[token]/vendor/vendor-timeline'

/** One sample wedding day for the run-sheet mock. */
export const SAMPLE_RUN_SHEET_EVENT: VendorEvent = {
  id: 'rs-event',
  date: '2026-09-14',
  venue: 'The Glasshouse, Sydney',
}

/** Sample timeline items rendered in the run-sheet mock. */
export const SAMPLE_RUN_SHEET_ITEMS: VendorTimelineItem[] = [
  {
    id: 'rs-1',
    event_id: 'rs-event',
    start_time: '17:00',
    title: 'Guest arrival',
    description: 'Doors open; canapés and drinks served on arrival.',
    duration_min: 30,
    position: 0,
    pending_review: false,
  },
  {
    id: 'rs-2',
    event_id: 'rs-event',
    start_time: '17:45',
    title: 'Couple grand entrance',
    description: null,
    duration_min: 15,
    position: 1,
    pending_review: false,
  },
  {
    id: 'rs-3',
    event_id: 'rs-event',
    start_time: '19:00',
    title: 'Speeches',
    description: 'Best man, then maid of honour, then the couple.',
    duration_min: 45,
    position: 2,
    pending_review: false,
  },
  {
    id: 'rs-4',
    event_id: 'rs-event',
    start_time: '20:30',
    title: 'First dance',
    description: null,
    duration_min: 10,
    position: 3,
    pending_review: false,
  },
]
