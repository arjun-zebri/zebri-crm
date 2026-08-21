/**
 * Starter meeting types, offered as one-click prefills.
 *
 * A blank create form asks an MC to invent a duration, a buffer and a notice
 * period before they have any feel for what those should be. These are the
 * meetings wedding MCs and celebrants actually run, so the common case becomes
 * "accept and save" rather than "guess at eight fields".
 *
 * Every template is 30 minutes or an hour. Those are the two lengths that fit
 * a real working day, and offering a spread of odd durations only invites
 * calendars that never line up.
 *
 * Templates only seed the create form. Nothing is written until the MC saves,
 * so picking one is free and reversible.
 *
 * @module app/(dashboard)/calendar/meeting-type-templates
 */

/** The only two lengths a template may use. */
export type TemplateDuration = 30 | 60;

/** Values a template seeds into the create form. */
export interface MeetingTypeTemplate {
  /** Stable key, used for React keys and test hooks. */
  id: string;
  name: string;
  description: string;
  durationMinutes: TemplateDuration;
  /** Matches `meeting_types.location_type`. */
  locationType: 'video' | 'phone' | 'in_person';
}

/**
 * Human label for a template duration.
 *
 * "1 hour" rather than "60 min", because that is how anyone booking a meeting
 * says it out loud.
 */
export function templateDurationLabel(minutes: TemplateDuration): string {
  return minutes === 60 ? '1 hour' : '30 min';
}

/** The starter set shown above the meeting type grid. */
export const MEETING_TYPE_TEMPLATES: MeetingTypeTemplate[] = [
  {
    id: 'intro-call',
    name: 'Intro call',
    description:
      'First chat with an enquiring couple: their date, the venue, and how they want the day to feel.',
    durationMinutes: 30,
    locationType: 'video',
  },
  {
    id: 'ceremony-planning',
    name: 'Ceremony planning',
    description:
      'Shape the ceremony with the couple: vows, readings, rituals and who stands where.',
    durationMinutes: 60,
    locationType: 'video',
  },
  {
    id: 'noim-paperwork',
    name: 'NOIM and paperwork',
    description:
      'Complete the Notice of Intended Marriage and sight original ID. Must be lodged at least one month before the wedding.',
    durationMinutes: 30,
    locationType: 'in_person',
  },
  {
    id: 'run-sheet-review',
    name: 'Run sheet review',
    description:
      'Walk the order of the day, lock in timings, and confirm names and pronunciations.',
    durationMinutes: 60,
    locationType: 'video',
  },
  {
    id: 'final-catch-up',
    name: 'Final catch-up',
    description:
      'Quick confirmation in the week of the wedding: final numbers, arrival times and any late changes.',
    durationMinutes: 30,
    locationType: 'phone',
  },
];
