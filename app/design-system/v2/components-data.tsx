'use client';

import type { ReactNode } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Backdrop } from '@/components/ui-v2/backdrop';
import { Button } from '@/components/ui-v2/button';
import { Insight } from '@/components/ui-v2/insight';
import { MediaCard } from '@/components/ui-v2/media-card';
import { MirrorChart } from '@/components/ui-v2/mirror-chart';
import { Panel } from '@/components/ui-v2/panel';
import { RowSections, type RowSection } from '@/components/ui-v2/row-sections';
import { Stat, StatStrip } from '@/components/ui-v2/stat-strip';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Waterfall } from '@/components/ui-v2/waterfall';

import { Group, Spec } from './showroom-v2';

/**
 * v2 list and figure pieces: the stat strip, row sections, stretched button, media card, waterfall,
 * insight and mirror chart,
 * the shapes the dashboard pages are built from (the Payments and
 * Proposals Overview figures, Clients' For you, the Invoices, Contracts
 * and Proposals lists, the Proposals waterfall and attention chart). Each sits on a
 * slice of the backdrop, since both are glass and read wrong on white.
 *
 * @module app/design-system/v2/components-data
 */

type Status = 'overdue' | 'soon' | 'paid';
const SECTIONS: RowSection<Status>[] = [
  { id: 'overdue', title: 'Overdue', dot: 'bg-danger' },
  { id: 'soon', title: 'Due in the next 30 days', dot: 'bg-warning' },
  { id: 'paid', title: 'Paid', dot: 'bg-grass-500', shut: true },
];
const ROWS: { id: string; who: string; amount: string; status: Status }[] = [
  { id: 'a', who: 'Ella & Noah', amount: '$900', status: 'overdue' },
  { id: 'b', who: 'Amelia & Jack', amount: '$1,450', status: 'soon' },
  { id: 'c', who: 'Zoe & Liam', amount: '$1,300', status: 'soon' },
  { id: 'd', who: 'Grace & Sam', amount: '$1,000', status: 'paid' },
];

/** A slice of the grass and sky, for glass demos. */
function OnBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden rounded-panel p-6">
      <Backdrop contained />
      {children}
    </div>
  );
}

/** The Lists & figures group. */
export function ComponentsDataV2() {
  return (
    <Group id="data" title="Lists & figures">
      <Spec
        name="Stat strip"
        file="components/ui-v2/stat-strip.tsx"
        description="A few headline figures on one panel, split by its 5% hairline rather than boxed as separate cards. Each is a label, the figure, and one line on what it means now. A swatch ties a stat to a chart series; danger turns a figure red only while it needs attention. bare drops the panel: the figures sit on the backdrop, each led by a thin rule down its left side; with columns (the page's two-column grid) they go two over each column below. onClick makes a stat a button that goes to what it counts."
      >
        <OnBackdrop>
          <StatStrip>
            <Stat label="Received" swatch="bg-grass-700" value="$10,600">
              <span className="text-grass-800">↑ 13% on this time last year</span>
            </Stat>
            <Stat label="To come" value="$24,450">
              $7,450 in the next 30 days
            </Stat>
            <Stat label="Overdue" swatch="bg-danger/70" value="$2,100" danger>
              2 invoices · oldest 12 days
            </Stat>
            <Stat label="GST collected" value="$964">
              Q1 BAS due 28 Oct
            </Stat>
          </StatStrip>
        </OnBackdrop>
        <OnBackdrop>
          <StatStrip bare>
            <Stat label="Received so far" swatch="bg-grass-700" value="$10,600">
              <span className="text-grass-800">Up 13% on last year</span>
            </Stat>
            <Stat label="Overdue" swatch="bg-danger/70" value="$2,100" onClick={() => undefined}>
              2 invoices · oldest 12 days
            </Stat>
            <Stat label="GST collected" value="$964">
              Q1 BAS due 28 Oct
            </Stat>
          </StatStrip>
        </OnBackdrop>
      </Spec>
      <Spec
        name="Stretched button"
        file="components/ui-v2/stretched-button.tsx"
        description="The one real button behind a clickable row or card: it wraps the title and its hit area covers the whole row, so the row opens from anywhere and stays one control for keyboards. Buttons that must stay clickable sit in a relative z-10 wrapper. The row owns the hover."
      >
        <OnBackdrop>
          <Panel className="p-2">
            <div className="relative flex cursor-pointer items-center gap-4 rounded-button px-3 py-3 transition-colors duration-150 hover:bg-zebra-950/[0.03]">
              <Avatar name="Ella" tone="soft" />
              <div className="min-w-0 flex-1">
                <StretchedButton label="Open invoice 1040, Ella & Noah" onClick={() => undefined}>
                  <span className="block type-label text-zebra-950">Ella &amp; Noah</span>
                  <span className="block type-body text-zebra-500">Deposit · #1040</span>
                </StretchedButton>
              </div>
              <div className="relative z-10">
                <Button variant="secondary">Send reminder</Button>
              </div>
            </div>
          </Panel>
        </OnBackdrop>
      </Spec>
      <Spec
        name="Media card"
        file="components/ui-v2/media-card.tsx"
        description="A glass card with a picture edge to edge on top and a caption under it; the whole card opens the thing (its title is a stretched button) and hovering shades the caption one step. The Proposals Templates tab uses it with each template's shrunk cover."
      >
        <OnBackdrop>
          <div className="grid max-w-md gap-3 sm:grid-cols-2">
            <MediaCard
              media={<div className="h-32 bg-grass-100" />}
              title="Full day MC"
              onOpen={() => undefined}
            >
              <p className="type-body text-zebra-500">Ceremony to last dance</p>
              <p className="type-body text-zebra-700">Sent 35 times · 35% accepted</p>
            </MediaCard>
            <MediaCard
              media={<div className="h-32 bg-azure-100" />}
              title="Ceremony only"
              onOpen={() => undefined}
            >
              <p className="type-body text-zebra-500">A friend on the mic after</p>
              <p className="type-body text-zebra-700">Sent 20 times · 47% accepted</p>
            </MediaCard>
          </div>
        </OnBackdrop>
      </Spec>
      <Spec
        name="Waterfall"
        file="components/ui-v2/waterfall.tsx"
        description="A starting total, the amounts lost along the way as floating grey bars, and what is left at the end in deep green. Dashed rules carry each level across; one loss can be picked out in amber for the step the page talks about, with the reason said in words beside it. focus lights one loss and fades the rest, for a list beside the chart pointing at a row's step (the second chart)."
      >
        <OnBackdrop>
          <Panel className="px-5 py-4">
            <Waterfall
              label="Proposals from sent to booked"
              start={{ label: 'Sent', sub: 'proposals', value: 21 }}
              drops={[
                { label: 'Didn’t open', value: 4 },
                { label: 'Left before packages', value: 2 },
                { label: 'Saw packages, didn’t accept', value: 8 },
                { label: 'Accepted, no deposit', value: 2 },
              ]}
              end={{ label: 'Booked', sub: 'deposit paid' }}
              highlight={2}
              plotClassName="h-48"
            />
          </Panel>
        </OnBackdrop>
        <OnBackdrop>
          <Panel className="px-5 py-4">
            <Waterfall
              label="Proposals from sent to booked, one step in focus"
              start={{ label: 'Sent', sub: 'proposals', value: 21 }}
              drops={[
                { label: 'Didn’t open', value: 4 },
                { label: 'Left before packages', value: 2 },
                { label: 'Saw packages, didn’t accept', value: 8 },
                { label: 'Accepted, no deposit', value: 2 },
              ]}
              end={{ label: 'Booked', sub: 'deposit paid' }}
              highlight={2}
              focus={0}
              plotClassName="h-48"
            />
          </Panel>
        </OnBackdrop>
      </Spec>
      <Spec
        name="Insight"
        file="components/ui-v2/insight.tsx"
        description="One piece of Zebri AI's advice, with no box: the finding in bold, why in grey with the numbers behind it, the one fix to try in black, and an optional secondary button that starts it. It has no Zebri mark of its own; what holds it says it is Zebri's. The Proposals Overview's AI insights dialog (opened from a Button variant ai on the waterfall) stacks up to three."
      >
        <OnBackdrop>
          <Panel className="max-w-sm px-5 py-4">
            <Insight
              finding="Couples stall at your packages."
              why="8 of 15 who saw them didn’t accept. Most were weighing Premium MC at $4,350."
              fix="Try leading with Classic MC and showing Premium MC as an upgrade."
              action={<Button variant="secondary">Try it on Full day MC</Button>}
            />
          </Panel>
        </OnBackdrop>
      </Spec>
      <Spec
        name="Mirror chart"
        file="components/ui-v2/mirror-chart.tsx"
        description="How two people spent their time down an ordered list: a smooth shape, one person each side of a thin seam, as wide as their time on the row beside it. The longest row is bold, the rest grey; a legend names the colours. `active` bolds another row and `marker` draws a line across the shape, which the proposal modal drives from the preview's scroll (shown here partway through Packages)."
      >
        <div className="max-w-sm">
          <MirrorChart
            people={['Sophie', 'Max']}
            rows={[
              { label: 'Welcome', a: 30, b: 18 },
              { label: 'Video hello', a: 20, b: 11 },
              { label: 'How it works', a: 22, b: 14 },
              { label: 'Packages', a: 200, b: 62 },
              { label: 'Their words', a: 8, b: 4 },
              { label: 'Accept', a: 25, b: 16 },
            ]}
            active={3}
            marker={3.4}
          />
        </div>
      </Spec>
      <Spec
        name="Row sections"
        file="components/ui-v2/row-sections.tsx"
        description="A list split by what needs attention: a dot, title, count and note over rows on glass, each section folding from its heading. Empty sections are left out; settled ones start folded. The caller renders the rows."
      >
        <OnBackdrop>
          <RowSections
            sections={SECTIONS}
            items={ROWS}
            sectionOf={(r) => r.status}
            renderRow={(r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-button px-3 py-3 hover:bg-zebra-950/[0.03]"
              >
                <Avatar name={r.who} tone="soft" />
                <span className="min-w-0 flex-1 truncate type-label text-zebra-950">{r.who}</span>
                <span className="type-label tabular-nums text-zebra-950">{r.amount}</span>
              </li>
            )}
          />
        </OnBackdrop>
      </Spec>
    </Group>
  );
}
