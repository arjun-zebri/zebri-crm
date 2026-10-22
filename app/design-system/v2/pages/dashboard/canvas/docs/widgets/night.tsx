'use client';

import { schedule, startText } from '../../../home/run-sheet-schedule';
import type { Moment } from '../../../home/run-sheets';
import { KitText, useRule } from '../kit-text';

/**
 * The night's parts, drawn in the kit: a run sheet's moments in time
 * order (time, the moment, the cue on the mic, who runs it) and a
 * ceremony script's words. Both come from what the MC wrote in the run
 * sheet and the script, never typed on the page.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/widgets/night
 */

/** The run sheet's moments, one ruled row each. */
export function Timeline({ moments }: { moments: Moment[] }) {
  const slots = schedule(moments);
  const faint = useRule();
  return (
    <div className="w-full">
      {moments.map((m, i) => (
        // A faint rule in the kit's ink between moments: a runtime colour.
        <div key={m.id} style={{ borderBottom: `1px solid ${faint}` }} className="grid grid-cols-[6rem_minmax(0,1fr)_8rem] gap-6 py-3">
          <KitText tone="brand" className="tabular-nums">{startText(slots[i]) || 'Then'}</KitText>
          <div className="space-y-0.5">
            <KitText strong>{m.moment}</KitText>
            {m.cue ? <KitText tone="muted">{m.cue}</KitText> : null}
          </div>
          <KitText tone="muted" className="text-right">{m.owner}</KitText>
        </div>
      ))}
    </div>
  );
}

/** A ceremony script's words, as written, paragraph by paragraph. */
export function ScriptBody({ text }: { text: string }) {
  return (
    <div className="w-full space-y-4">
      {text.split(/\n{2,}/).map((para, i) => (
        <KitText key={i} className="whitespace-pre-line">
          {para}
        </KitText>
      ))}
    </div>
  );
}
