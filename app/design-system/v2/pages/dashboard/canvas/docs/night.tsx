'use client';

import type { Moment } from '../../home/run-sheets';

import { field, logo, M, page, part, rule, text, W } from './build';
import { businessFields, type DesignSpec } from './spec';
import { ScriptBody, Timeline } from './widgets/night';

/**
 * The run sheet and the ceremony script as designs. The run sheet's
 * timeline and the script's words are locked: they are written in the run
 * sheet and the script, and suppliers work from them on the night. The
 * header around them is the MC's.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/night
 */

/** Who the night is for, as written on the page: "Sarah & Tom", and their date and venue. */
interface Couple {
  couple: string;
  when?: string | undefined;
}

/** What a run sheet is filled from. */
export interface RunSheetData extends Couple {
  moments: Moment[];
}

/** What a script is filled from. */
export interface ScriptData extends Couple {
  text: string;
}

const SAMPLE_COUPLE: Couple = { couple: 'Sarah & Tom', when: 'Saturday 12 March 2027 · Stones of the Yarra Valley' };

/** The start of a night, to design against. */
const NIGHT: Moment[] = [
  { id: 'n1', moment: 'Guests arrive', time: '2:00 pm', minutes: 30, cue: 'Strings on the lawn', owner: 'Venue' },
  { id: 'n2', moment: 'Ceremony', time: '', minutes: 30, cue: 'Processional: A Thousand Years', owner: 'Celebrant' },
  { id: 'n3', moment: 'Canapés and portraits', time: '', minutes: 60, cue: 'Golden hour at 5:40 pm', owner: 'Photographer' },
  { id: 'n4', moment: 'Grand entrance', time: '6:00 pm', minutes: 10, cue: 'Say it: Sarah and Tom Wood', owner: 'MC' },
  { id: 'n5', moment: 'Speeches', time: '', minutes: 40, cue: 'Father of the bride, then best man', owner: 'MC' },
];

const coupleFields = (c: Couple) => ({ couple: c.couple, 'event.line': c.when ?? '' });
const coupleNames = { couple: 'Couple', 'event.line': 'Date and venue' };

export const RUN_SHEET: DesignSpec<RunSheetData> = {
  kind: 'run-sheet',
  label: 'Run sheet',
  layout: () => ({
    id: 'run-sheet',
    kind: 'run-sheet',
    title: 'Run sheet',
    pages: [
      page('run-sheet-1', [
        logo('logo', { x: M, y: M, w: 240, h: 40 }),
        text('kind', 'Label', 'Run sheet', 'caption', { x: M, y: 140, w: W }, { color: 'kit:primary' }),
        field('couple', 'Couple', 'couple', 'heading', { x: M, y: 166, w: W }, { size: 38 }),
        field('event', 'Date and venue', 'event.line', 'body', { x: M, y: 226, w: W }, { color: 'kit:muted' }),
        rule('rule', { x: M, y: 274, w: W }),
        part('timeline', 'Timeline', 'timeline', { x: M, y: 300, w: W, h: 640 }),
        field('foot', 'Your name', 'mc', 'body', { x: M, y: 1060, w: W }, { color: 'kit:muted', locked: true }),
      ]),
    ],
  }),
  sample: () => ({ ...SAMPLE_COUPLE, moments: NIGHT }),
  fill: ({ moments, ...client }, account) => {
    const b = businessFields(account);
    return {
      fields: { ...b.fields, ...coupleFields(client) },
      fieldNames: { ...b.fieldNames, ...coupleNames },
      widgets: { timeline: () => <Timeline moments={moments} /> },
    };
  },
};

export const SCRIPT: DesignSpec<ScriptData> = {
  kind: 'script',
  label: 'Ceremony script',
  layout: () => ({
    id: 'script',
    kind: 'script',
    title: 'Ceremony script',
    pages: [
      page('script-1', [
        text('kind', 'Label', 'Ceremony script', 'caption', { x: M, y: M, w: W }, { color: 'kit:primary' }),
        field('couple', 'Couple', 'couple', 'heading', { x: M, y: 92, w: W }, { size: 38 }),
        field('event', 'Date and venue', 'event.line', 'body', { x: M, y: 152, w: W }, { color: 'kit:muted' }),
        part('script', 'Script', 'script', { x: M, y: 230, w: W, h: 780 }),
      ]),
    ],
  }),
  sample: () => ({
    ...SAMPLE_COUPLE,
    text: 'Welcome, everyone. My name is Arjun, and it is my honour to stand here with Sarah and Tom today.\n\nThey met on a rainy Tuesday in a bookshop in Fitzroy, both reaching for the last copy of the same book.\n\nSo let us begin.',
  }),
  fill: ({ text: words, ...client }, account) => {
    const b = businessFields(account);
    return {
      fields: { ...b.fields, ...coupleFields(client) },
      fieldNames: { ...b.fieldNames, ...coupleNames },
      widgets: { script: () => <ScriptBody text={words} /> },
    };
  },
};
