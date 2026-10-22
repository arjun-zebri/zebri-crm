import type { EventFacts } from './run-sheet-demo';
import { schedule } from './run-sheet-schedule';
import { lengthOf, minutesOf, newId, type Moment } from './run-sheets';

/**
 * What Zebri notices about the night, said in a few words under the
 * event line and nowhere else: sunset landing in the middle of a moment
 * with no portraits planned (with Add portraits, one click), and the
 * night running past the venue's close. Nothing when the night is fine.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-insights
 */

export interface Insight {
  id: string;
  text: string;
  /** The obvious fix, when there is one. */
  action?: { label: string; apply: (moments: Moment[]) => Moment[] } | undefined;
}

/** Everything worth a word on this night. */
export function insightsFor(moments: Moment[], facts: EventFacts): Insight[] {
  const slots = schedule(moments);
  const out: Insight[] = [];
  const sunset = minutesOf(facts.sunset);
  const i = slots.findIndex(
    (s) =>
      sunset !== null && s.start !== null && s.end !== null && s.start <= sunset && sunset < s.end,
  );
  const during = moments[i];
  if (during && !moments.some((m) => /sunset/i.test(m.moment))) {
    out.push({
      id: 'sunset',
      text: `Sunset ${facts.sunset} falls in ${during.moment || 'a moment'}`,
      action: {
        label: 'Add portraits',
        // Just ahead of the moment sunset falls in, while the light is best.
        apply: (ms) => {
          const at = ms.findIndex((m) => m.id === during.id);
          const add: Moment = {
            id: newId(),
            moment: 'Sunset portraits',
            time: '',
            minutes: 10,
            owner: 'Photographer',
            cue: '',
          };
          return [...ms.slice(0, at), add, ...ms.slice(at)];
        },
      },
    });
  }
  const finish = minutesOf(facts.finish);
  const end = Math.max(0, ...slots.map((s) => s.end ?? 0));
  if (finish !== null && end > finish)
    out.push({ id: 'finish', text: `Runs ${lengthOf(end - finish)} past the venue's close` });
  return out;
}
