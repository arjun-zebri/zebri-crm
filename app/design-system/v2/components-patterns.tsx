'use client';

import { Button } from '@/components/ui-v2/button';

import { EmptyState } from './pages/dashboard/empty-state';
import { EditorHeader } from './pages/dashboard/payments/modal/editor-header';
import { MoreBelow } from './pages/dashboard/proposals/editor/more-below';
import { Group, Spec } from './showroom-v2';

/**
 * v2 page patterns: the pieces the first-run pages are built from that
 * are not primitives but recur across pages. An empty page's state on
 * the backdrop, a send-flow editor's header, and the glow that says a
 * page preview carries on below. Each renders from its real source.
 *
 * @module app/design-system/v2/components-patterns
 */
export function ComponentsPatternsV2() {
  return (
    <Group id="patterns" title="Page patterns">
      <Spec
        name="Empty state"
        file="app/design-system/v2/pages/dashboard/empty-state.tsx"
        description="A page with nothing in it yet: a heading and one line of what will live there, on the backdrop with no panel, centred on the screen (the page stretches so it can fill the space under the title, lifted by about half the title row). A white card around nothing reads as an empty box."
      >
        <div className="relative h-72 overflow-hidden rounded-panel bg-zebra-50">
          <EmptyState title="No proposals yet" body="Every proposal you send shows here, with who opened it and what they chose." />
        </div>
      </Spec>
      <Spec
        name="Editor header"
        file="app/design-system/v2/pages/dashboard/payments/modal/editor-header.tsx"
        description="A send-flow editor's header (New contract, New invoice; the proposal editor matches): the title, then the one action and Close past a hairline, top right. Title only in the send flow: a second line made the bar tall, and the page below says who it is for."
      >
        <div className="overflow-hidden rounded-panel bg-field ring-1 ring-zebra-950/5">
          <EditorHeader title="New invoice" action={<Button>Send to Clara</Button>} onClose={() => undefined} />
        </div>
      </Spec>
      <Spec
        name="More below"
        file="app/design-system/v2/pages/dashboard/proposals/editor/more-below.tsx"
        description="A 64px blurred glow stuck to the bottom edge of a scrolling page preview, so the MC knows it carries on; it fades once the end is in view. Put it last inside the desk (p-5 md:p-8), whose padding its offsets match. Scroll the box."
      >
        <div className="h-64 overflow-y-auto rounded-panel bg-zebra-50 p-5 md:p-8">
          <div className="space-y-4 rounded-check bg-field p-6 type-body text-zebra-700 shadow-sm">
            {['Welcome', 'How it works', 'Your packages', 'What couples say', 'Accept'].map((h) => (
              <div key={h} className="space-y-1">
                <p className="type-label text-zebra-950">{h}</p>
                <p>A section of the proposal, long enough that the page runs past the bottom of the box it sits in.</p>
              </div>
            ))}
          </div>
          <MoreBelow />
        </div>
      </Spec>
    </Group>
  );
}
