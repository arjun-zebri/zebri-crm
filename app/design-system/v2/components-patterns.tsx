'use client';


import { EmptyState } from '@/components/ui-v2/empty-state';
import { ListOrderedIcon } from '@/components/ui-v2/icons';

import { BlockRow } from './pages/dashboard/blocks/block-row';
import { blockById } from './pages/dashboard/blocks/catalog';
import { useBlocks } from './pages/dashboard/blocks/use-blocks';
import { MoreBelow } from './pages/dashboard/proposals/editor/more-below';
import { UpNextRow } from './pages/dashboard/up-next-row';
import { Group, Spec } from './showroom-v2';

/**
 * v2 page patterns: the pieces the first-run pages are built from that
 * are not primitives but recur across pages. An empty page's state on
 * the backdrop, a send-flow editor's header, the glow that says a
 * page preview carries on below, an Up next to-do and a Blocks row. Each renders from its real source.
 *
 * @module app/design-system/v2/components-patterns
 */
export function ComponentsPatternsV2() {
  const blocks = useBlocks({ initial: ['proposals'] });
  const rows = ['proposals', 'timeline', 'video'].flatMap((id) => blockById(id) ?? []);
  return (
    <Group id="patterns" title="Page patterns">
      <Spec
        name="Empty page"
        file="app/design-system/v2/pages/dashboard/documents/documents-page.tsx"
        description="A page with nothing in it yet, built on the EmptyState primitive (under Display) in its page form: a heading and one line of what will live there, on the backdrop with no panel, centred on the screen (the page stretches so it can fill the space under the title, lifted by about half the title row). A white card around nothing reads as an empty box."
      >
        <div className="relative h-72 overflow-hidden rounded-panel bg-zebra-50">
          <EmptyState
            title="No proposals yet"
            body="Every proposal you send shows here, with who opened it and what they chose."
          />
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
                <p>
                  A section of the proposal, long enough that the page runs past the bottom of the
                  box it sits in.
                </p>
              </div>
            ))}
          </div>
          <MoreBelow />
        </div>
      </Spec>
      <Spec
        name="Up next to-do"
        file="app/design-system/v2/pages/dashboard/up-next-row.tsx"
        description="A row that is the MC's own job, not something to look at: the row does nothing, its one button does the job (primary for the move that matters now). Buttons only ever sit on the MC's to-dos. A feature with no page is pushed this way, once, when it is due (a run sheet four weeks out), never on the day it is added."
      >
        <div className="max-w-2xl rounded-panel bg-field p-2 ring-1 ring-hairline">
          <UpNextRow
            lead={
              <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-zebra-100 text-zebra-700">
                <ListOrderedIcon aria-hidden="true" className="size-4" />
              </span>
            }
            title="Sarah & Tom's run sheet"
            detail="is not started yet."
            action={{ label: 'Start', primary: true, onClick: () => undefined }}
          />
        </div>
      </Spec>
      <Spec
        name="Block row"
        file="app/design-system/v2/pages/dashboard/blocks/block-row.tsx"
        description="One block in the Blocks list: its mark, name and one line of pitch, the whole row opening its page. No Add button here or in Works with: a block is added once and kept, so it is added from its own page after reading what it does, and every add ends on the same next step (where it lives, Show me or Open). The right side only says where it stands: Added, or Coming soon; Max sits by the name."
      >
        <ul className="max-w-2xl">
          {rows.map((b) => (
            <BlockRow key={b.id} block={b} blocks={blocks} onOpen={() => undefined} />
          ))}
        </ul>
      </Spec>
    </Group>
  );
}
