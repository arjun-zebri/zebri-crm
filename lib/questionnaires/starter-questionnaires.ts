/**
 * Seeded starter catalog for questionnaire templates.
 *
 * Nothing here is auto-added; an MC browses and adds these from the Templates
 * page, after which the rows are flagged `is_starter` and stay fully editable.
 * Question ids are stable kebab strings so a cloned starter has sensible keys
 * in its responses map. Mirrors `lib/contracts/starter-contracts.ts`.
 *
 * @module lib/questionnaires/starter-questionnaires
 */

import type { Question } from './question-schema'

/** A canonical starter questionnaire definition. */
export interface StarterQuestionnaire {
  name: string
  description: string
  questions: Question[]
}

/** The seeded starter questionnaires, in catalog order. */
export const STARTER_QUESTIONNAIRES: StarterQuestionnaire[] = [
  {
    name: 'Ceremony details',
    description: 'Names, order of proceedings, and the moments that matter.',
    questions: [
      { id: 'partner-1-name', type: 'short_text', label: 'Partner 1 full name', required: true },
      { id: 'partner-2-name', type: 'short_text', label: 'Partner 2 full name', required: true },
      { id: 'pronunciation', type: 'long_text', label: 'Any names we should know how to pronounce? Spell them out for us.', required: false },
      { id: 'ceremony-time', type: 'time', label: 'What time does the ceremony begin?', required: true },
      {
        id: 'ceremony-style',
        type: 'single_choice',
        label: 'How would you describe the tone of your ceremony?',
        required: false,
        options: ['Relaxed and fun', 'Warm and heartfelt', 'Traditional and formal'],
      },
      { id: 'readings', type: 'long_text', label: 'Are there any readings, and who is performing them?', required: false },
      { id: 'special-moments', type: 'long_text', label: 'Any rituals or special moments to include (handfasting, sand, family blessings)?', required: false },
    ],
  },
  {
    name: 'Reception & music',
    description: 'First dances, announcements, and the do-not-play list.',
    questions: [
      { id: 'reception-music', type: 'section', label: 'Music', required: false },
      { id: 'entrance-song', type: 'short_text', label: 'Grand entrance song (and how should we announce you?)', required: false },
      { id: 'first-dance', type: 'short_text', label: 'First dance song', required: false },
      { id: 'parent-dances', type: 'long_text', label: 'Any parent or special dances? List the song and people.', required: false },
      { id: 'do-not-play', type: 'long_text', label: 'Anything on your do-not-play list?', required: false },
      { id: 'reception-formalities', type: 'section', label: 'Formalities', required: false },
      {
        id: 'speeches',
        type: 'multiple_choice',
        label: 'Which formalities are you including?',
        required: false,
        options: ['Welcome speech', 'Speeches / toasts', 'Cake cutting', 'Bouquet toss', 'Late-night send-off'],
      },
      { id: 'speakers', type: 'long_text', label: 'Who is giving speeches, and in what order?', required: false },
    ],
  },
  {
    name: 'Logistics & key people',
    description: 'The run sheet essentials and who to find on the day.',
    questions: [
      { id: 'guest-count', type: 'number', label: 'Roughly how many guests?', required: false },
      { id: 'venue-contact', type: 'short_text', label: 'On-the-day venue contact (name and number)', required: false },
      { id: 'planner', type: 'short_text', label: 'Wedding planner or coordinator, if you have one', required: false },
      { id: 'other-vendors', type: 'long_text', label: 'Other key vendors we should coordinate with (photographer, band, caterer)?', required: false },
      { id: 'kids-present', type: 'yes_no', label: 'Will there be children at the wedding?', required: false },
      { id: 'access-notes', type: 'long_text', label: 'Anything about access, parking, or setup we should know?', required: false },
    ],
  },
]

/** Resolves starter definitions by name, preserving catalog order. */
export function starterQuestionnairesByName(names: readonly string[]): StarterQuestionnaire[] {
  const wanted = new Set(names)
  return STARTER_QUESTIONNAIRES.filter((q) => wanted.has(q.name))
}
