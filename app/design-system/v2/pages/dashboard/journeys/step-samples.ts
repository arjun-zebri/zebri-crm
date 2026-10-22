import type { Moment } from '../home/run-sheets';
import type { Question, Template } from '../questionnaires/questionnaire-data';

/**
 * What a step's preview shows before the MC has made their own: a
 * questionnaire and a run sheet as they would read for the sample
 * couple, so the step dialog's page is never a blank sheet. Once the MC
 * has a questionnaire, or a run sheet with moments in it, the preview
 * shows theirs instead.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-samples
 */

const q = (id: string, type: Question['type'], label: string, help = '', options: string[] = []): Question => ({ id, type, label, help, required: false, options });

/** A wedding day questionnaire, the kind most MCs send. */
export const SAMPLE_QUESTIONNAIRE: Template = {
  id: 'sample',
  title: 'Wedding day details',
  intro: 'A few questions so I can plan the night around you. It saves as you go.',
  style: 'page',
  edited: '',
  questions: [
    q('s1', 'section', 'The two of you'),
    q('s2', 'short_text', 'How do you say your names?', 'As you would want them said on the mic'),
    q('s3', 'long_text', 'How did you meet?'),
    q('s4', 'section', 'On the night'),
    q('s5', 'song', 'Your entrance song'),
    q('s6', 'song', 'Your first dance'),
    q('s7', 'long_text', 'Who is giving a speech, and in what order?'),
    q('s8', 'single_choice', 'Would you like games or a quiz?', '', ['Yes, keep it fun', 'Just one', 'No thanks']),
    q('s9', 'long_text', 'Anything I should avoid mentioning?'),
  ],
};

const m = (id: string, moment: string, time: string, minutes: number, cue: string, owner: string): Moment => ({ id, moment, time, minutes, cue, owner });

/** A reception's moments, start to last dance. */
export const SAMPLE_MOMENTS: Moment[] = [
  m('r1', 'Guests seated', '6:00 pm', 15, 'Welcome, housekeeping, bar is open', 'MC'),
  m('r2', 'Bridal party entrance', '', 10, 'September by Earth, Wind & Fire', 'DJ'),
  m('r3', 'Entrée served', '', 30, '', 'Caterer'),
  m('r4', 'Speeches', '7:00 pm', 30, 'Father of the bride, best man, the couple', 'MC'),
  m('r5', 'Main served', '', 45, '', 'Caterer'),
  m('r6', 'Cake cutting', '8:30 pm', 10, 'Photographer ready by the cake table', 'Photographer'),
  m('r7', 'First dance', '', 5, 'Can I Have This Dance', 'DJ'),
  m('r8', 'Dance floor opens', '', 120, '', 'DJ'),
  m('r9', 'Last dance and farewell', '11:30 pm', 15, 'Sparkler tunnel at the front doors', 'MC'),
];
