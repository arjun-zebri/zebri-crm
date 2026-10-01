'use client';

import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { Textarea } from '@/components/ui-v2/textarea';

import { CallChecklist } from './call-checklist';
import type { LiveCall as Live } from './use-calls';
import { useElapsed, VideoTile } from './video-tile';

/**
 * The call in progress, taking over the profile's main area under the
 * client's name. The stage holds the client large and the MC's own view
 * in the corner, with the clock and a plain "Recording audio" line above
 * it (only audio is ever recorded), and mute, camera, the join link and
 * End call below. Beside it, the checklist to tick off and a notes pad
 * that takes the rest of the column;
 * Zebri reads the pad alongside the transcript when it writes the notes.
 *
 * Choosing another section keeps the call going: a bar under the header
 * brings it back.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/live-call
 */

// Who is talking, in turn, so the demo stage looks alive.
const TURNS = ['them', 'you', 'them', 'them', 'you'] as const;
const TURN_MS = 2600;

export interface LiveCallProps {
  live: Live;
  /** "Amelia & Jack", and their initials for the tile. */
  who: string;
  initials: string;
  link: string;
  checklist: string[];
  onTick: (item: string) => void;
  onJot: (scratch: string) => void;
  onEnd: () => void;
}

/** The live call. See {@link LiveCallProps}. */
export function LiveCall({ live, who, initials, link, checklist, onTick, onJot, onEnd }: LiveCallProps) {
  const clock = useElapsed(live.startedAt);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTurn((t) => (t + 1) % TURNS.length), TURN_MS);
    return () => window.clearInterval(id);
  }, []);
  const talking = TURNS[turn];
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto motion-safe:animate-[fade-in_200ms_ease-out_both] lg:flex-row lg:overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-5 md:px-10 md:py-8">
        <div className="flex items-center gap-4 type-body">
          <span className="inline-flex items-center gap-2 text-zebra-950">
            <span aria-hidden="true" className="size-2 rounded-pill bg-danger motion-safe:animate-pulse" />
            Recording audio
          </span>
          <span className="text-grass-700">Zebri is taking notes</span>
          <span aria-label="Call time" className="ml-auto tabular-nums text-zebra-500">
            {clock}
          </span>
        </div>
        <div className="relative min-h-72 flex-1">
          <VideoTile initials={initials} name={who} speaking={talking === 'them'} />
          <div className="absolute bottom-3 right-3 aspect-video w-32 shadow-lg ring-2 ring-field sm:w-44 rounded-panel">
            <VideoTile initials="You" name="You" small speaking={talking === 'you'} muted={muted} cameraOff={cameraOff} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            square
            round
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <MicOff aria-hidden="true" strokeWidth={1.5} className="size-4" /> : <Mic aria-hidden="true" strokeWidth={1.5} className="size-4" />}
          </Button>
          <Button
            variant="secondary"
            square
            round
            aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
            aria-pressed={cameraOff}
            onClick={() => setCameraOff((c) => !c)}
          >
            {cameraOff ? <VideoOff aria-hidden="true" strokeWidth={1.5} className="size-4" /> : <Video aria-hidden="true" strokeWidth={1.5} className="size-4" />}
          </Button>
          <CopyButton value={link} label="Copy join link" />
          <Button variant="danger" onClick={onEnd}>
            End call
          </Button>
        </div>
      </div>
      <aside
        aria-label="During the call"
        className="flex shrink-0 flex-col gap-10 border-t border-zebra-200 px-5 py-8 md:px-10 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-8"
      >
        <CallChecklist items={checklist} checked={live.checked} onTick={onTick} />
        <Textarea
          label="Your notes"
          help="Zebri reads these with the call."
          rows={12}
          fill
          value={live.scratch}
          onChange={(e) => onJot(e.target.value)}
        />
      </aside>
    </div>
  );
}
