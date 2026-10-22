'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { useBlocks } from './pages/dashboard/blocks/use-blocks';
import { BookedCelebration } from './pages/dashboard/first-run/booked-celebration';
import { BuildYourZebri } from './pages/dashboard/first-run/build-your-zebri';
import { PlanSheet } from './pages/dashboard/first-run/plan-sheet';
import { TypedLine } from './pages/dashboard/first-run/typed-line';
import { ZebriSays } from './pages/dashboard/first-use/zebri-says';
import { Group, Spec } from './showroom-v2';

/**
 * v2 moments: the motion that carries a new MC through their first
 * client. The live line that writes in each reply, the paced Add all of
 * the starting blocks, the plan sheet, and the booking celebration (with
 * its side cannons). Each plays from its real source.
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
  const [planOpen, setPlanOpen] = useState(false);
  const [said, setSaid] = useState(0);
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
        name="Plan sheet"
        file="app/design-system/v2/pages/dashboard/first-run/plan-sheet.tsx"
        description="Start your free week, as Stripe Checkout and Superhuman's upgrade sheet lay it out, monthly only: a split, the value on the left (Pro and Max with a radio mark, who each is for, whole-dollar prices beside the usual price struck and what they go back to after a year, then what the picked plan includes, an icon a line) and the payment on a neutral tint on the right (due today $0, the trial as three dated steps, Apple Pay and Google Pay, the card as one CardField, Start free week, the charge date in the fine print). No header or footer bars; a quiet × top right."
      >
        <Button variant="secondary" onClick={() => setPlanOpen(true)}>
          Open the plan sheet
        </Button>
        <PlanSheet key={String(planOpen)} who={planOpen ? '' : null} initial="pro" onStart={() => setPlanOpen(false)} onClose={() => setPlanOpen(false)} />
      </Spec>
      <Spec
        name="Block first use"
        file="app/design-system/v2/pages/dashboard/first-use/zebri-says.tsx"
        description="A block's whole onboarding: no tour, nothing to skip. Its page opens in the state its kind needs (needs a connection: only that step, then a drawn tick; needs understanding: starters already on), with one line from Zebri typed out on arrival. Live at /design-system/v2/dashboard/new/booking-links. Run sheets have no page: Show me opens the next booked client's Documents, where Zebri's line sits above the drafted sheet."
      >
        <ZebriSays key={said} text="Zebri drafted Sarah & Tom's night from a usual wedding. Change a time, add a cue, then send it to Sarah to sign off.">
          <Button variant="secondary" onClick={() => setSaid((n) => n + 1)}>
            Type it again
          </Button>
        </ZebriSays>
      </Spec>
      <Spec
        name="Booking celebration"
        file="app/design-system/v2/pages/dashboard/first-run/booked-celebration.tsx"
        description="The test client's deposit lands: a compact card over Home, on a light backdrop, lit from behind by a soft brand halo (card-glow.tsx) and one burst of confetti from each bottom corner (side-cannons.tsx, canvas-confetti: long tumbling ribbons and a few squares in grass and champagne only, then stillness), never the brand colour as the page. Then the names in the MC's heading font at regular weight, the deposit counting up, then the line: three stops for what the MC did (proposal, contract, deposit), lit 800ms apart as it reaches them, each circle filling with a slight spring and its tick drawing itself (DrawnCheck). Then one button, Open Journeys, which in the first run opens Journeys with the couple on their next step, dated, and the line saying what Zebri sends next (journey-booked-line.tsx)."
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
          onNext={() => setCelebrating(false)}
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
