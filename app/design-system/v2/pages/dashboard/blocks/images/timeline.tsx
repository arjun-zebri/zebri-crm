import { RunSheetDetail } from '../../home/run-sheet-detail';
import { BLOCK_SWATCHES } from '../../home/run-sheet-edges';
import { RunSheetBar, RunSheetHeader } from '../../home/run-sheet-header';
import { schedule } from '../../home/run-sheet-schedule';
import { RunSheetTimeline } from '../../home/run-sheet-timeline';
import type { Moment, RunSheet } from '../../home/run-sheets';

import { BlockImageFrame, SCENE_CARD } from './block-image-frame';

/**
 * Run sheets product image (block id `timeline`): Rosa and Finn's night
 * at Werribee Mansion on the real run sheet, its header over the evening
 * drawn as a calendar day with the sunset line, and the first dance
 * picked and open in front (`RunSheetDetail`) down to its notes. Both
 * are laid out at real width and shrunk to half, as the Proposals image
 * is, so the notes fit in the frame.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/timeline
 */

const none = () => undefined;
const [, GREEN, BLUE, GOLD, PINK, LILAC] = BLOCK_SWATCHES;
const FACTS = { ceremony: '4:00 pm', venue: 'Werribee Mansion', sunset: '7:45 pm', finish: '11:30 pm' };

const MOMENTS: Moment[] = [
  { id: 'a', moment: 'Grand entrance', time: '6:15 pm', minutes: 10, cue: 'September, Earth Wind & Fire', owner: 'MC', status: 'Confirmed', color: GREEN },
  { id: 'b', moment: 'Entrée', time: '', minutes: 45, cue: '', owner: 'Caterer' },
  { id: 'c', moment: 'Golden hour portraits', time: '', minutes: 25, cue: 'Out to the rose garden', owner: 'Photographer', color: GOLD },
  { id: 'd', moment: 'Speeches', time: '', minutes: 30, cue: 'Dad, then Bianca, then Finn', owner: 'MC', status: 'Confirmed', color: BLUE },
  { id: 'e', moment: 'First dance', time: '', minutes: 10, cue: "Song: Can't Help Falling in Love, Kina Grannis. Lights down, sparklers ready.", owner: 'DJ', status: 'Confirmed', color: LILAC },
  { id: 'f', moment: 'Dance floor opens', time: '', minutes: 90, cue: '', owner: 'DJ', color: PINK },
];
const SHEET: RunSheet = { moments: MOMENTS, status: 'approved', version: 2 };
const FIRST_DANCE = 4;

/** Run sheets block image. */
export function TimelineImage() {
  return (
    <BlockImageFrame alt="Rosa and Finn's run sheet drawn as an evening, with the first dance open in front with its song and cues.">
      <div className={`${SCENE_CARD} left-8 top-6 h-[38rem] w-[34rem] origin-top-left scale-[0.5] space-y-4 px-10 pt-10`}>
        <div className="flex flex-col gap-6">
          <RunSheetBar inset={false} onClose={none} />
          <RunSheetHeader client="Rosa & Finn" sheet={SHEET} when="Sat 6 Mar 2027 · Werribee Mansion" insights={[]} onApply={none} />
        </div>
        {/* The day opens at 3pm (an hour before the ceremony); cut to just above 6pm (3 hours at PX 2.4 a minute, less room for its label). */}
        <div className="h-[60rem] overflow-hidden">
          <div className="-mt-[416px]">
            <RunSheetTimeline moments={MOMENTS} facts={FACTS} selected={MOMENTS[FIRST_DANCE]!.id} onSelect={none} onChange={none} />
          </div>
        </div>
      </div>
      <div className={`${SCENE_CARD} right-5 top-16 h-[34rem] w-[20rem] origin-top-right scale-[0.5] p-8 shadow-md`}>
        <RunSheetDetail moment={MOMENTS[FIRST_DANCE]!} slot={schedule(MOMENTS)[FIRST_DANCE]} onChange={none} onTime={none} onRemove={none} />
      </div>
    </BlockImageFrame>
  );
}
