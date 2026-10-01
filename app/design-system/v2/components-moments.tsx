'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { useBlocks } from './pages/dashboard/blocks/use-blocks';
import { BookedCelebration } from './pages/dashboard/first-run/booked-celebration';
import { BuildYourZebri } from './pages/dashboard/first-run/build-your-zebri';
import { TypedLine } from './pages/dashboard/first-run/typed-line';
import { Group, Spec } from './showroom-v2';

/**
 * v2 moments: the motion that carries a new MC through their first
 * client. The live line that writes in each reply, the paced Add all of
 * the starting blocks, and the booking celebration (with its side
 * cannons). Each plays from its real source.
 *
 * @module app/design-system/v2/components-moments
 */

const LINES = [
  'Sent. Waiting for Clara to open it…',
  'Clara opened your proposal.',
  'Clara is looking at MC package…',
  'Clara accepted MC package, $2,400.',
];

export function ComponentsMomentsV2() {
  // The documents set the MC's brand fonts, which only the editors load otherwise.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  const [line, setLine] = useState(0);
  const [building, setBuilding] = useState(false);
  const [blocksKey, setBlocksKey] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  return (
    <Group id="moments" title="Moments">
      <Spec
        name="Typed line"
        file="app/design-system/v2/pages/dashboard/first-run/typed-line.tsx"
        description="Home's live commentary while the test client replies: each letter fades and sharpens in, 22ms apart on the frame clock, no caret; the old line fades before the next. The whole line is laid out from the first frame, so a centred line never slides. Up next steps aside while it runs."
      >
        <div className="space-y-4 text-center">
          <p aria-live="polite" className="mx-auto max-w-xl text-balance type-lead text-zebra-500">
            <TypedLine text={LINES[line] ?? ''} />
          </p>
          <Button variant="secondary" onClick={() => setLine((n) => (n + 1) % LINES.length)}>
            Next reply
          </Button>
        </div>
      </Spec>
      <Spec
        name="Recommended starting blocks"
        file="app/design-system/v2/pages/dashboard/first-run/build-your-zebri.tsx"
        description="Add all is paced to be watched: a beat after the click, then one row at a time, each Added badge and drawn tick finished before the next; the button holds 'Add all 3' under its spinner, and Done replaces it only once the last tick has drawn."
      >
        <Button
          variant="secondary"
          onClick={() => {
            setBlocksKey((k) => k + 1);
            setBuilding(true);
          }}
        >
          Open the dialog
        </Button>
        <FreshBlocks key={blocksKey} open={building} onClose={() => setBuilding(false)} />
      </Spec>
      <Spec
        name="Booking celebration"
        file="app/design-system/v2/pages/dashboard/first-run/booked-celebration.tsx"
        description="The test client's deposit lands: a compact card over Home, on a light backdrop, lit from behind by a soft brand halo (card-glow.tsx) and one burst of confetti from each bottom corner (side-cannons.tsx, canvas-confetti: long tumbling ribbons and a few squares in grass and champagne only, then stillness), never the brand colour as the page. Then the names in the MC's heading font at regular weight, the deposit counting up, then the journey: one slow linear line through four stops that light 800ms apart as it reaches them, each circle filling with a slight spring and its tick drawing itself (DrawnCheck). Home opens up only after, one piece at a time."
      >
        <Button variant="secondary" onClick={() => setCelebrating(true)}>
          Play the celebration
        </Button>
        <BookedCelebration
          key={String(celebrating)}
          open={celebrating}
          couple="Clara & Felix"
          when="Fri 26 Mar 2027 · The Boathouse, Sydney"
          paid={600}
          onClose={() => setCelebrating(false)}
        />
      </Spec>
    </Group>
  );
}

/** The starting-blocks dialog over a fresh set of blocks, so every opening starts from none added. */
function FreshBlocks({ open, onClose }: { open: boolean; onClose: () => void }) {
  const blocks = useBlocks({ initial: [] });
  return <BuildYourZebri open={open} blocks={blocks} onClose={onClose} onDone={onClose} />;
}
