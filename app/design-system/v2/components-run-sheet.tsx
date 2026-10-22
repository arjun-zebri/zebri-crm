'use client';

import { useState } from 'react';

import { DocRow } from './pages/dashboard/clients/profile/doc-row';
import { withSheet } from './pages/dashboard/clients/profile/run-sheet-doc';
import { RUN_SHEET_DOC } from './pages/dashboard/clients/profile/run-sheet-doc-seed';
import { RunSheetDetail } from './pages/dashboard/home/run-sheet-detail';
import { placeAt, schedule } from './pages/dashboard/home/run-sheet-schedule';
import { RunSheetSide } from './pages/dashboard/home/run-sheet-side';
import { RunSheetTimeline } from './pages/dashboard/home/run-sheet-timeline';
import type { Moment, RunSheet } from './pages/dashboard/home/run-sheets';
import { Group, Spec } from './showroom-v2';

/**
 * v2 run sheet: the night drawn as a calendar day, the picked moment's
 * detail, the side panel's empty how-to, and the Documents panel of a
 * sheet not started. Each renders from its real source; the day and the
 * detail share one set of moments here, so editing either shows in both.
 *
 * @module app/design-system/v2/components-run-sheet
 */

const FACTS = {
  ceremony: '2:30 pm',
  venue: 'Stones of the Yarra Valley',
  sunset: '7:28 pm',
  finish: '10:30 pm',
};

const SEED: Moment[] = [
  {
    id: 'a',
    moment: 'Ceremony',
    time: '2:30 pm',
    minutes: 30,
    cue: '',
    owner: 'Celebrant',
    status: 'Confirmed',
  },
  {
    id: 'b',
    moment: 'Canapés on the lawn',
    time: '',
    minutes: 90,
    cue: '',
    owner: 'Venue',
    color: '#a3d97a',
  },
  {
    id: 'c',
    moment: 'Family photos',
    time: '3:15 pm',
    minutes: 30,
    cue: '',
    owner: 'Photographer',
    color: '#92cdf7',
  },
  {
    id: 'd',
    moment: 'Entrance',
    time: '5:30 pm',
    minutes: 15,
    cue: 'Signed, Sealed, Delivered',
    owner: 'MC',
  },
  {
    id: 'e',
    moment: 'Speeches',
    time: '',
    minutes: 45,
    cue: '',
    owner: 'MC',
    status: 'Waiting on couple',
    color: '#f2a7b8',
  },
];

const EMPTY: RunSheet = { moments: [], status: 'draft', version: 1 };

export function ComponentsRunSheetV2() {
  const [moments, setMoments] = useState(SEED);
  const [picked, setPicked] = useState<string>('d');
  const slots = schedule(moments);
  const i = moments.findIndex((m) => m.id === picked);
  const m = moments[i];
  return (
    <Group id="run-sheet" title="Run sheet">
      <Spec
        name="Day"
        file="app/design-system/v2/pages/dashboard/home/run-sheet-timeline.tsx"
        description="The night as a calendar day, 2.4px a minute: hours down the left on hairlines, each moment a block at its time and as tall as it runs. A block is a soft tint of its colour (45% into white, 60% on hover) with dark text, the name over who runs it and its status once it is 44px tall. Click an empty time to add a 30 minute moment there (a faint + block follows the pointer, on the quarter hour). Drag a block to move just it, in 5 minute steps; on hover, round handles top and bottom pull its start and end. A block that starts inside the one above is set in a third and ringed white. The ceremony (green), sunset (amber) and the venue closing (grey, red once the night runs past it) are thin lines over the blocks, named on a white chip at the right, and never take a click. The selected block carries a 2px green ring. Only the day scrolls."
      >
        <div className="h-[28rem] overflow-y-auto rounded-panel bg-field p-6 ring-1 ring-zebra-950/5">
          <RunSheetTimeline
            moments={moments}
            facts={FACTS}
            selected={picked}
            onSelect={setPicked}
            onChange={setMoments}
          />
        </div>
      </Spec>
      <Spec
        name="Moment"
        file="app/design-system/v2/pages/dashboard/home/run-sheet-detail.tsx"
        description="The picked moment in the side panel, as New client's details are: the name as an unboxed title (focused when new) with a quiet grey bin beside it, then label and value rows: Time, Length, Who, Status (each a quiet chip; Who and Status end with a line to add your own) and Colour, a round swatch that opens the picker, no hex beside it. Notes last and large, eight lines and growing: songs, who speaks, names to say right, and anything to ask the couple. No boxes, no dividers."
      >
        <div className="max-w-md">
          {m ? (
            <RunSheetDetail
              key={m.id}
              moment={m}
              slot={slots[i]}
              after={slots[i - 1]?.end ?? undefined}
              onChange={(patch) =>
                setMoments(moments.map((x) => (x.id === m.id ? { ...x, ...patch } : x)))
              }
              onTime={(start) => setMoments(placeAt(moments, m.id, start))}
              onRemove={() => setMoments(moments.filter((x) => x.id !== m.id))}
            />
          ) : null}
        </div>
      </Spec>
      <Spec
        name="Side panel, nothing picked"
        file="app/design-system/v2/pages/dashboard/home/run-sheet-side.tsx"
        description="28rem wide on the right of the xl dialog, standing still while the day scrolls. With nothing picked it says how to add a moment, in three short lines (wide screens only; a phone gets one line above the day instead, since the panel sits under it there). Its foot holds the sheet's only two actions, Download and Send, off until there is a moment."
      >
        <div className="flex h-80 overflow-hidden rounded-panel bg-field ring-1 ring-zebra-950/5">
          <RunSheetSide
            empty
            onClose={() => undefined}
            onDownload={() => undefined}
            onSend={() => undefined}
          />
        </div>
      </Spec>
      <Spec
        name="Not started, in Documents"
        file="app/design-system/v2/pages/dashboard/clients/profile/run-sheet-doc.tsx"
        description="A sheet with no moments is a to-do, not an empty draft: its row reads Run sheet, To start, and opens the run sheet. Once it has a moment it becomes the usual document, one line saying how many moments and which version, then at the right edge where it stands with the couple, with They approved it beside it while it is with them."
      >
        <ul className="-mx-3 max-w-xl">
          <DocRow doc={withSheet(RUN_SHEET_DOC, EMPTY, 'Sarah & Tom')} onOpen={() => undefined} />
        </ul>
      </Spec>
    </Group>
  );
}
