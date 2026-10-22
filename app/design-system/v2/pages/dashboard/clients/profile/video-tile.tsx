import { useEffect, useState } from 'react';

import { MicOffIcon } from '@/components/ui-v2/icons';

/**
 * A stand-in video feed for the demo call: a soft dark field with the
 * person's initials, ringed green while they are talking. With the
 * camera off the field goes flat, as a real call's would. Also
 * {@link useElapsed}, the call clock shared by the stage and the bar
 * that shows while the MC looks at another section.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/video-tile
 */

export interface VideoTileProps {
  initials: string;
  name: string;
  speaking: boolean;
  muted?: boolean | undefined;
  cameraOff?: boolean | undefined;
  /** The self view in the corner: smaller initials. */
  small?: boolean | undefined;
}

/** A video tile. See {@link VideoTileProps}. */
export function VideoTile({ initials, name, speaking, muted, cameraOff, small }: VideoTileProps) {
  return (
    <div
      className={`relative flex size-full items-center justify-center overflow-hidden rounded-panel ${
        cameraOff
          ? 'bg-zebra-900'
          : 'bg-[radial-gradient(circle_at_50%_35%,var(--color-zebra-700),var(--color-zebra-950))]'
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-pill bg-zebra-600 text-zebra-50 transition-shadow duration-150 motion-reduce:transition-none ${
          small ? 'size-10 type-label' : 'size-24 type-heading'
        } ${speaking && !muted ? 'ring-3 ring-grass-400' : ''}`}
      >
        {initials}
      </span>
      <span className="absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 type-body text-zebra-200">
        {muted ? <MicOffIcon aria-label="Muted" className="size-3.5" /> : null}
        {name}
      </span>
    </div>
  );
}

/** "03:07" since `startedAt`, ticking each second. */
export function useElapsed(startedAt: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
