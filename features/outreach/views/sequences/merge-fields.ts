/**
 * Plain-language names for merge fields, and the sample celebrant the
 * live preview fills in. Kept out of the view files so the copy lives in
 * one place.
 *
 * @module features/outreach/views/sequences/merge-fields
 */
import type { MergeField, MergeValues } from '@/lib/outreach/render';

/** What each merge field means to the founder. */
export const FIELD_LABELS: Record<MergeField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  full_name: 'Full name',
  suburb: 'Suburb',
  state: 'State',
  website: 'Website',
  instagram_handle: 'Instagram handle',
  booking_link: 'Booking link',
  sender_name: 'Your name',
};

/** Values for the preview. A made-up celebrant, so no real prospect is shown. */
export const SAMPLE_VALUES: MergeValues = {
  first_name: 'Jane',
  last_name: 'Smith',
  full_name: 'Jane Smith',
  suburb: 'Bondi',
  state: 'NSW',
  website: 'janesmithcelebrant.com.au',
  instagram_handle: '@janesmithcelebrant',
  booking_link: 'https://app.zebri.com.au/book/example?ref=abcd2345',
  sender_name: 'Arjun',
};

/** Stands in for the signature the sender set in Settings. */
export const SAMPLE_SIGNATURE = '[Your signature from Settings]';

/** Shown under every preview so the founder knows the names are fake. */
export const PREVIEW_NOTE = 'Preview uses a sample celebrant called Jane in Bondi.';
