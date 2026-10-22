import type { JSONContent } from '@tiptap/core';

import { DEFAULT_SCRIPT_FONT, type ScriptFontId } from '@/lib/documents/script-fonts';

import { CLIENTS, clientName } from '../clients/clients-data';
import { DEMO_USER, NEXT_EVENT } from '../demo-data';
import { demoFor, hasDemo } from '../home/run-sheet-demo';
import { answerText, asked } from '../questionnaires/questionnaire-data';
import { sentFor } from '../questionnaires/questionnaire-store';

/**
 * What a script is, and the details it can fill in. A script is a page
 * the MC writes freely (any language, their own words, page breaks where
 * they choose) for one client. Where a detail belongs (a name, how to say
 * it, the first dance), the MC drops in a field instead of typing it: it
 * shows and prints as the couple's real answer, and fills itself in when
 * the answer arrives. The real app reads the fields from the client, the
 * event and the questionnaire; the preview makes them up (`demoFor`).
 *
 * @module app/design-system/v2/pages/dashboard/scripts/scripts-data
 */

/** One script. */
export interface Script {
  /** Lasts through renames, for keys and the Documents row. */
  id: string;
  /** "Ceremony script", the MC's own name for it; empty until they name it. */
  title: string;
  /** The page as TipTap JSON; null before the first word. */
  content: JSONContent | null;
  /** The face the whole page is set in. */
  font: ScriptFontId;
}

/** Where a detail comes from, which is the heading it sits under. */
export type FieldGroup = 'client' | 'event' | 'answers' | 'people';

/** The headings, in the order the panel shows them. */
export const FIELD_GROUPS: { id: FieldGroup; title: string }[] = [
  { id: 'client', title: 'Client' },
  { id: 'event', title: 'Event' },
  { id: 'answers', title: 'Their answers' },
  { id: 'people', title: 'People on the day' },
];

/** A detail a script can fill in. */
export interface ScriptField {
  /** Stored on the field in the page (`variable` node `id`). */
  id: string;
  /** "Venue", or for an answer the question as the MC asked it. */
  label: string;
  /** The answer, or null while it is still to come. */
  value: string | null;
  group: FieldGroup;
}

/** The script every client starts with, so it has a name before the MC gives it one. */
export const CEREMONY_SCRIPT_ID = 'script-ceremony';

/** A new script, empty and unnamed. */
export const newScript = (id = `script-${Math.random().toString(36).slice(2, 9)}`): Script => ({
  id,
  title: '',
  content: null,
  font: DEFAULT_SCRIPT_FONT,
});

/**
 * What a script is called where it is listed: the MC's name for it, or,
 * until they give one, what it most likely is. The same words are the
 * title's placeholder, so the page and its Documents row agree.
 */
export const scriptName = (s: Script): string =>
  s.title.trim() || (s.id === CEREMONY_SCRIPT_ID ? 'Ceremony script' : 'Untitled script');

/**
 * Everything Zebri knows about a client that a script can fill in, by
 * where it comes from: the client (each person, and you), the event, the
 * answers to the questionnaires sent to them, and the suppliers on the
 * event.
 * Only real details: a client the preview knows nothing about gets no
 * made-up venue or time.
 */
export function fieldsFor(client: string): ScriptField[] {
  const { facts, suppliers } = demoFor(client);
  const known = hasDemo(client);
  const c = CLIENTS.find((x) => clientName(x) === client);
  const people = client.split(/\s*&\s*/).filter(Boolean);
  const date = c?.date ?? (client === NEXT_EVENT.client ? 'Sat 3 Oct 2026' : null);
  return [
    ...people.map((name, i) => ({ id: `person_${i + 1}`, label: people.length > 1 ? `Person ${i + 1}` : 'Name', value: name, group: 'client' as const })),
    { id: 'mc', label: 'You', value: DEMO_USER.name, group: 'client' },
    { id: 'date', label: 'Date', value: date, group: 'event' },
    { id: 'start', label: 'Starts', value: known ? facts.ceremony : null, group: 'event' },
    { id: 'venue', label: 'Venue', value: known ? facts.venue : (c?.venue ?? null), group: 'event' },
    // Every question in every questionnaire sent to them, worded as the MC
    // asked it: a wedding MC's first dance, a corporate MC's award winners.
    ...sentFor(client).flatMap((s) =>
      asked(s.copy).map((q) => ({
        id: `q_${s.id}_${q.id}`,
        label: q.label.trim() || 'Untitled question',
        value: answerText(s.answers[q.id]).trim() || null,
        group: 'answers' as const,
      })),
    ),
    ...suppliers.map((p) => ({ id: `who_${p.type.toLowerCase()}`, label: p.type, value: p.name, group: 'people' as const })),
  ];
}
