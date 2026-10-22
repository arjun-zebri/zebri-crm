/**
 * Ready-made question sets for the booking form, one per kind of business.
 *
 * A preset is data, not schema: adding one inserts ordinary questions into a
 * meeting type, which the business can then rename, reorder or delete. That is
 * how the form stays industry-neutral while a wedding MC still starts with the
 * questions they always ask.
 *
 * @module lib/booking/question-presets
 */
import type { BookingQuestion } from './questions';

/** A named set of starter questions. */
export interface QuestionPreset {
  /** Stable key, for React keys and test hooks. */
  id: string;
  /** Shown in the editor's "Add a preset" menu. */
  label: string;
  /** Questions to append. Ids are re-minted on insert. */
  questions: BookingQuestion[];
}

/** Wedding-day basics, mapped onto the contact record. */
const WEDDING: QuestionPreset = {
  id: 'wedding',
  label: 'Wedding',
  questions: [
    { id: 'partner_name', label: "Partner's name", type: 'short_text', required: false, maps_to: 'partner_name' },
    { id: 'wedding_date', label: 'Wedding date', type: 'date', required: false, maps_to: 'event_date' },
    { id: 'venue', label: 'Venue', type: 'short_text', required: false, maps_to: 'venue', help: 'Or the suburb, if the venue is not locked in yet' },
  ],
};

/** Corporate and private events. */
const EVENT: QuestionPreset = {
  id: 'event',
  label: 'Event',
  questions: [
    { id: 'event_date', label: 'Event date', type: 'date', required: false, maps_to: 'event_date' },
    { id: 'venue', label: 'Venue', type: 'short_text', required: false, maps_to: 'venue' },
    { id: 'guest_count', label: 'Expected guests', type: 'number', required: false },
    {
      id: 'event_kind',
      label: 'What kind of event is it?',
      type: 'single_choice',
      required: false,
      options: ['Corporate', 'Birthday', 'Gala or awards', 'Other'],
    },
  ],
};

/** Works for any business that books a call. */
const GENERAL: QuestionPreset = {
  id: 'general',
  label: 'General enquiry',
  questions: [
    { id: 'company', label: 'Company', type: 'short_text', required: false },
    { id: 'topic', label: 'What would you like to cover?', type: 'long_text', required: false },
    {
      id: 'referral',
      label: 'How did you hear about us?',
      type: 'single_choice',
      required: false,
      options: ['Instagram', 'Google', 'A friend', 'A venue or supplier', 'Other'],
    },
  ],
};

/** Every preset, in menu order. */
export const QUESTION_PRESETS: QuestionPreset[] = [WEDDING, EVENT, GENERAL];

/** The wedding preset's questions, for the wedding meeting-type templates. */
export const WEDDING_QUESTIONS: BookingQuestion[] = WEDDING.questions;
