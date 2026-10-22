'use client';

import { Badge } from '@/components/ui-v2/badge';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { SparklesIcon, VideoIcon } from '@/components/ui-v2/icons';

import { ShotFrame } from './shot-frame';

/**
 * A call that writes its own notes: what Video calls (a Max block) files
 * on the client when the call ends, the facts it picked out as the
 * client page's label and value rows, and the to-dos as real checkboxes.
 * Demo content.
 *
 * @module app/design-system/v2/pages/website/ai-call-shot
 */

const LEARNED: [string, string][] = [
  ['Ceremony', '3:00 pm, Centennial Park'],
  ['Reading', 'Sam, Noah’s brother'],
  ['First dance', 'Yellow, Coldplay'],
  ['Please avoid', 'Speeches over three minutes'],
];

const TODOS = [
  'Send the Full day MC proposal',
  'Ask the venue about a garden mic',
  'Pencil in a rehearsal, Fri 5 Feb',
];

/** The call notes shot. */
export function CallShot() {
  return (
    <ShotFrame>
      <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
        <IconCircle icon={VideoIcon} />
        <span className="min-w-0 flex-1">
          <span className="block type-label text-zebra-950">Intro call with Ella & Noah</span>
          <span className="block type-body text-zebra-500">18 min · saved to their client</span>
        </span>
        <Badge tone="neutral">Max</Badge>
      </div>
      <div className="space-y-6 p-5">
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 type-label text-zebra-500">
            <SparklesIcon aria-hidden="true" className="size-4 text-grass-700" />
            Notes by Zebri
          </p>
          <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 type-body">
            {LEARNED.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-zebra-500">{label}</dt>
                <dd className="text-zebra-950">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-2 border-t border-hairline pt-5">
          <p className="type-label text-zebra-950">To-dos</p>
          {TODOS.map((t, i) => (
            <Checkbox key={t} label={t} defaultChecked={i === 0} readOnly />
          ))}
        </div>
      </div>
    </ShotFrame>
  );
}
