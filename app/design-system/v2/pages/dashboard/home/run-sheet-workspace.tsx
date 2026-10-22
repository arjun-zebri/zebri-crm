'use client';

import { useState } from 'react';

import { ZebriSays } from '../first-use/zebri-says';

import { editSheet, sendToCouple } from './run-sheet-actions';
import { RunSheetCopy } from './run-sheet-copy';
import { demoFor } from './run-sheet-demo';
import { RunSheetDetail } from './run-sheet-detail';
import { RunSheetBar, RunSheetHeader } from './run-sheet-header';
import { insightsFor } from './run-sheet-insights';
import { placeAt, schedule } from './run-sheet-schedule';
import { RunSheetSide } from './run-sheet-side';
import { useRunSheet } from './run-sheet-store';
import { RunSheetTimeline } from './run-sheet-timeline';
import type { Moment } from './run-sheets';

/**
 * One client's run sheet at the client profile's size, laid out as the
 * profile is: on the left `RunSheetHeader` (the couple's names, where it
 * stands, anything Zebri noticed) over the night drawn as a day
 * (`RunSheetTimeline`), which scrolls on its own; on the right a side
 * panel that stays put (`RunSheetSide`), holding the picked moment
 * (`RunSheetDetail`) or how to add one, with Download and Send at its
 * foot. A sheet starts empty. Changes save as they are made; when
 * something happens on its own (the couple approved it), Zebri says so
 * in one line under the names.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-workspace
 */

export interface RunSheetWorkspaceProps {
  client: string;
  /** Under the names: "Sat 3 Oct · Stones of the Yarra Valley". */
  when?: string | undefined;
  onClose: () => void;
}

/** The open sheet. See {@link RunSheetWorkspaceProps}. */
export function RunSheetWorkspace({ client, when, onClose }: RunSheetWorkspaceProps) {
  const sheet = useRunSheet(client);
  const { facts } = demoFor(client);
  const [picked, setPicked] = useState<string>();
  const [copy, setCopy] = useState(false);
  const { moments } = sheet;
  const slots = schedule(moments);
  const i = moments.findIndex((m) => m.id === picked);
  const m = moments[i];
  const edit = (next: Moment[]) => editSheet(client, sheet, next);
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <RunSheetBar onClose={onClose} />
        <div className="space-y-4 px-6 pb-6 pt-2 sm:px-10">
          <RunSheetHeader
            client={client}
            sheet={sheet}
            when={when}
            insights={insightsFor(moments, facts)}
            onApply={(apply) => edit(apply(moments))}
          />
          {sheet.news ? <ZebriSays key={sheet.news} text={sheet.news} /> : null}
        </div>
        {/* Only the day scrolls; the header above and the side panel stay put. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-3 sm:px-10">
          {/* On phones the side panel's how-to sits under the day, out of sight: one line here instead. */}
          {m ? null : (
            <p className="pb-4 type-body text-zebra-500 lg:hidden">
              {moments.length
                ? 'Tap a moment to change it, or an empty time to add one.'
                : 'Tap a time to add the first moment.'}
            </p>
          )}
          <RunSheetTimeline
            moments={moments}
            facts={facts}
            selected={m?.id}
            onSelect={setPicked}
            onChange={edit}
          />
        </div>
      </div>
      <RunSheetSide
        empty={!moments.length}
        onClose={onClose}
        // Download shows the copy they get, in the MC's brand, with Download PDF on it.
        onDownload={() => setCopy(true)}
        onSend={() => sendToCouple(client)}
      >
        {m ? (
          <RunSheetDetail
            key={m.id}
            moment={m}
            slot={slots[i]}
            after={slots[i - 1]?.end ?? undefined}
            onChange={(patch) => edit(moments.map((x) => (x.id === m.id ? { ...x, ...patch } : x)))}
            onTime={(start) => edit(placeAt(moments, m.id, start))}
            onRemove={() => edit(moments.filter((x) => x.id !== m.id))}
          />
        ) : undefined}
      </RunSheetSide>
      <RunSheetCopy open={copy} client={client} when={when} moments={moments} onClose={() => setCopy(false)} />
    </div>
  );
}
