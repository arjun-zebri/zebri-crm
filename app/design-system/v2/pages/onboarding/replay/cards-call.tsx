import { Sparkles } from 'lucide-react';

import { Reveal, Row, type Beat } from './replay-parts';

/**
 * Scene 4, the video call: what is said on the call shows as a live
 * caption, and the fact Zebri's AI heard lands in the couple's record
 * a moment later, marked with a sparkle. The caption and the field
 * appear on the same beat, so the line from what was said to what was
 * saved is plain.
 *
 * @module app/design-system/v2/pages/onboarding/replay/cards-call
 */

/** What is said on each beat, who says it, and the field it fills. */
const LINES = [
  { who: 'Sarah', said: 'There’ll be about 140 of us.', label: 'Guests', value: '140' },
  { who: 'You', said: 'And the ceremony, 3:30 in the garden?', label: 'Ceremony', value: '3:30 pm, garden' },
  { who: 'Tom', said: 'We want to walk in to Mr Brightside.', label: 'Grand entrance', value: 'Mr Brightside' },
  { who: 'Sarah', said: 'Relaxed, and a packed dance floor.', label: 'The feel', value: 'Relaxed, big dance floor' },
];

/** A video tile: a soft dark field with initials, ringed while that side is talking. */
function Tile({ initials, name, speaking }: { initials: string; name: string; speaking: boolean }) {
  return (
    <div className="relative flex items-center justify-center rounded-button bg-[radial-gradient(circle_at_50%_35%,var(--color-zebra-800),var(--color-zebra-950))]">
      <span
        className={`flex size-11 items-center justify-center rounded-pill bg-zebra-700 type-label text-zebra-50 transition-shadow duration-500 motion-reduce:transition-none ${
          speaking ? 'shadow-[0_0_0_3px_var(--color-grass-400)]' : ''
        }`}
      >
        {initials}
      </span>
      <span className="absolute bottom-2 left-2.5 type-body text-zebra-300">{name}</span>
    </div>
  );
}

export function CallCard({ on }: { on: Beat }) {
  // The latest line said so far; before the first beat, nobody has spoken.
  const heard = [3, 2, 1, 0].find((k) => on(k));
  const line = heard === undefined ? null : LINES[heard];
  const youTalking = line?.who === 'You';
  return (
    <>
      <div className="shrink-0 overflow-hidden rounded-panel bg-zebra-950 p-1.5">
        {/* Its own row above the tiles: laid over them, it covered the
            avatars on a narrow card. */}
        <div className="flex px-1 pt-1 pb-2">
          <span className="flex items-center gap-1.5 rounded-pill bg-[var(--b-primary)] px-2.5 py-1 type-body text-[var(--b-on-primary)]">
            <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
            Zebri AI is taking notes
          </span>
        </div>
        <div className="grid h-28 grid-cols-2 gap-1.5">
          <Tile initials="S&T" name="Sarah & Tom" speaking={line !== null && !youTalking} />
          <Tile initials="You" name="You" speaking={youTalking} />
        </div>
        {/* The live caption: re-keyed per line so each one rises in. */}
        <div className="flex h-12 items-center px-2.5">
          {line ? (
            <p key={heard} className="truncate type-body text-zebra-100 motion-safe:animate-[reveal-up_400ms_cubic-bezier(0.22,1,0.36,1)_both]">
              <span className="text-zebra-400">{line.who}:</span> {line.said}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-4">
        <p className="flex items-center gap-1.5 type-label text-[var(--b-primary)]">
          <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
          Their record, filled from the call
        </p>
        <div className="mt-1">
          {LINES.map((l, i) => (
            <Row key={l.label} label={l.label} last={i === LINES.length - 1}>
              {/* A beat behind its caption: said, then saved. */}
              <Reveal on={on(i)} className="rounded-check bg-[var(--b-soft)] px-2 py-0.5 text-zebra-950 delay-500">
                {l.value}
              </Reveal>
            </Row>
          ))}
        </div>
      </div>
    </>
  );
}
