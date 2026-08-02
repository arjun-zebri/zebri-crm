/**
 * Play button for a stored audio clip (pronunciation recordings).
 *
 * Owns its own `<audio>` element and playback state, so the button can
 * show that something is playing. The previous pattern at each call
 * site looked up a hidden `<audio>` by id and called `.play()` with no
 * state at all, which left the user with no feedback that a clip had
 * started, finished, or was still going.
 *
 * Playing state is driven by the element's own events rather than the
 * click handler, so it stays correct when the clip ends by itself or is
 * paused from OS media controls.
 *
 * @module components/ui/audio-play-button
 */
'use client';

import { Play, Square } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';

export interface AudioPlayButtonProps {
  /** Source URL of the clip. */
  src: string;
  /** Text beside the icon. Omit for an icon-only button. */
  label?: string;
  /** Text swapped in while playing. Defaults to `Playing`. */
  playingLabel?: string;
  /** Layout classes applied in both states. */
  className?: string;
  /** Colour classes for the resting state. Swapped out entirely while
   *  playing rather than layered, because two competing Tailwind colour
   *  utilities resolve by stylesheet order, not by class order. */
  idleClassName?: string;
  /** Colour classes for the playing state — the emphasis tone that
   *  distinguishes an active clip. */
  playingClassName?: string;
  /** Inline style, for the branded public surfaces that colour their
   *  controls from the MC's palette rather than tokens. */
  style?: CSSProperties;
  /** Tooltip / accessible name for the icon-only variant. */
  title?: string;
  /** Pixel size of the icon. Defaults to 12 to match the call sites. */
  iconSize?: number;
}

/**
 * Three animated bars that read as "sound is coming out of this".
 * Purely decorative — the label already carries the meaning.
 */
function PlayingBars() {
  return (
    <span className="inline-flex items-end gap-px" aria-hidden>
      <span className="w-0.5 h-2 bg-current animate-pulse [animation-delay:-0.3s]" />
      <span className="w-0.5 h-3 bg-current animate-pulse [animation-delay:-0.15s]" />
      <span className="w-0.5 h-1.5 bg-current animate-pulse" />
    </span>
  );
}

export function AudioPlayButton({
  src,
  label,
  playingLabel = 'Playing',
  className = '',
  idleClassName = '',
  playingClassName = '',
  style,
  title,
  iconSize = 12,
}: AudioPlayButtonProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      // Rewind so the next click replays the name from the start rather
      // than resuming a half-heard word.
      el.currentTime = 0;
      return;
    }
    void el.play();
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        title={title ?? (playing ? 'Stop' : 'Play')}
        aria-label={label ? undefined : (title ?? 'Play pronunciation')}
        className={`${className} ${playing ? playingClassName : idleClassName}`}
        {...(style ? { style } : {})}
      >
        {playing ? (
          <Square size={iconSize} strokeWidth={2} className="fill-current" />
        ) : (
          <Play size={iconSize} strokeWidth={2} />
        )}
        {label ? (
          <span className="inline-flex items-center gap-1">
            {playing ? playingLabel : label}
            {playing ? <PlayingBars /> : null}
          </span>
        ) : null}
      </button>
    </>
  );
}
