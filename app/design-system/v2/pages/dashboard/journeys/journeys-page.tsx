'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { FLOATING } from '@/components/ui-v2/control-styles';
import { PlusIcon, UserPlusIcon } from '@/components/ui-v2/icons';
import { PillTabs } from '@/components/ui-v2/pill-tabs';

import { BarIcons } from '../bar-icons';
import { useTemplateChoices } from '../doc-builder/doc-types/proposal/template-store';
import type { DocumentsEntry } from '../documents/documents-page';
import { PageBar } from '../page-bar';
import { PageFrame } from '../page-frame';
import { TemplateEditor } from '../proposals/editor/template-editor';


import { AddClientDialog } from './add-client-dialog';
import { JourneyMenu } from './journey-menu';
import { JourneyPath, type Visitor } from './journey-path';
import { DOCUMENT_OF, type Journey, type JourneyStep } from './journeys-data';
import { WAIT_DOT, WAIT_LABEL } from './line-rules';
import { NewJourneyDialog } from './new-journey-dialog';
import { StepDialog } from './step-dialog';
import { waitsOnYou } from './up-next-data';
import { UpNextView } from './up-next-view';
import { useJourneys, type JourneysSource } from './use-journeys';
import { useUpNext } from './use-up-next';

/**
 * The v2 Journeys page: what every client gets from the MC, in order,
 * from first enquiry to thank you, one journey per type of work, and who
 * is where on it now. It is the dashboard's only automation page, with
 * Documents right after it in the sidebar (2026-10-05 founder: a journey
 * is a workflow; the Workflows page was removed 2026-10-14).
 *
 * The page is three things: the head (the title, then Add a client), pill tabs (a journey per type of work, each with
 * how many clients are on it; the picked pill holds its ⋯ menu, a
 * double-click renames one in place, the + adds one), and the line, which is all that scrolls; the
 * legend for the cards' dots is pinned to the bottom right of the screen. Every option sits on the thing it is about, and there are no
 * stats: a journey is where the MC sets up their process, and Home is
 * where they see what needs them. Removing or moving a step offers Undo.
 *
 * Before the journeys, an Up next pill (with how many sends and to-dos
 * wait on the MC) swaps the line for the queue of what the journeys are
 * about to do for which client (`up-next-view.tsx`): sends held for an
 * OK, the MC's to-dos, then what Zebri sends by itself. Only on the demo
 * business's journeys; a new account (`source`) has nothing queued yet.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/journeys-page
 */

export interface JourneysPageProps {
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons. */
  actions?: ReactNode;
  /** Goes to another page: Documents (on a kind), Clients, Email or Home. */
  onNavigate: (page: string, doc?: DocumentsEntry) => void;
  /** Journeys kept somewhere other than the demo store (the first run's own). */
  source?: JourneysSource | undefined;
  /** Clients shown on their step of the line. */
  visitors?: Visitor[] | undefined;
  /** A `data-tour` on the line, for the first run's spotlight. */
  tour?: string | undefined;
  /** A line above the journeys for a moment on the page (the first run's booked couple). */
  intro?: ReactNode;
  /** Plays the line in once: what is done for the shown client ticks off, then the rest rise in. */
  reveal?: boolean | undefined;
  /** Shows Add a client. Off in the first run, where Home is the way to a client (founder, 2026-10-08). */
  addClient?: boolean | undefined;
}

/** The Up next pill's value, beside the journeys' ids. */
const UP_NEXT = 'up-next';

/** The Journeys page. See {@link JourneysPageProps}. */
export function JourneysPage({
  heading: Heading = 'h1',
  actions,
  onNavigate,
  source,
  visitors,
  tour,
  intro,
  reveal,
  addClient = true,
}: JourneysPageProps) {
  const state = useJourneys(source);
  const { journeys } = state;
  const queue = useUpNext();
  const showQueue = !source;
  const waiting = queue.queue.filter(waitsOnYou).length;
  const template = useTemplateChoices()[0]?.key ?? null;
  const [current, setCurrent] = useState(journeys[0]?.id ?? '');
  const journey = journeys.find((j) => j.id === current) ?? journeys[0];
  const [open, setOpen] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ before: Journey; says: string } | null>(null);
  // The undo offer stays a while, then goes.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);
  if (!journey) return null;
  const upNext = showQueue && current === UP_NEXT;
  const step = journey.steps.find((s) => s.id === open) ?? null;
  const offer = (says: string) => setUndo({ before: journey, says });

  // A proposal opens its template over the page; other documents open where they live.
  const edit = (s: JourneyStep) => {
    if (s.kind === 'proposal' && template) return setEditing(template);
    setOpen(null);
    const kind = DOCUMENT_OF[s.kind];
    if (kind) onNavigate('Documents', { kind });
    else onNavigate(s.kind === 'email' ? 'Email' : 'Clients');
  };

  return (
    // Full height from md up so only the line scrolls.
    <PageFrame
      labelledBy="journeys-title"
      className="md:h-full"
      bar={
        <PageBar
          title={
            <Heading id="journeys-title" className="sr-only">
              Journeys
            </Heading>
          }
          tabs={
            <PillTabs
              label="Journey"
              options={[...(showQueue ? [UP_NEXT] : []), ...journeys.map((j) => j.id)]}
              labels={{
                [UP_NEXT]: 'Up next',
                ...Object.fromEntries(journeys.map((j) => [j.id, j.name])),
              }}
              counts={showQueue && waiting ? { [UP_NEXT]: waiting } : undefined}
              value={upNext ? UP_NEXT : journey.id}
              onChange={setCurrent}
              onRename={(id, name) => state.rename(id, name)}
              renaming={renaming}
              // Up next is not a journey: it has no name to change.
              onRenamingChange={(id) => setRenaming(id === UP_NEXT ? null : id)}
              menu={
                upNext ? null : (
                  <JourneyMenu
                    key={journey.id}
                    journey={journey}
                    state={state}
                    onShow={setCurrent}
                    onRename={() => setRenaming(journey.id)}
                  />
                )
              }
              after={
                <Button variant="ghost" square round aria-label="New journey" onClick={() => setNaming(true)}>
                  <PlusIcon aria-hidden="true" className="size-4" />
                </Button>
              }
            />
          }
          toolbar={
            addClient && !upNext ? (
              <BarIcons>
                <Button
                  variant="ghost"
                  square
                  aria-label="Add a client"
                  tooltip="Add a client"
                  tooltipAlign="end"
                  onClick={() => setAdding(true)}
                >
                  <UserPlusIcon aria-hidden="true" className="size-4" />
                </Button>
              </BarIcons>
            ) : null
          }
          actions={actions}
        />
      }
    >
      {intro ? <div className="type-body text-zebra-500">{intro}</div> : null}

      {upNext ? (
        // Scrolls on its own, like the line, so the pills stay put above it.
        <div className="w-full md:-mx-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-3 md:pt-1">
          <UpNextView
            state={queue}
            journeys={journeys}
            onOpenStep={(j, s) => (setCurrent(j), setOpen(s))}
          />
        </div>
      ) : (
        /* Only the line scrolls: the title, Add a client and the journeys stay put above it. Padded so a card's focus mark and the dragged card are not clipped, and so the last step clears the legend. */
        <div className="w-full md:-mx-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-3 md:pt-1 md:pb-20">
          <JourneyPath
            journey={journey}
            visitors={visitors}
            tour={tour}
            reveal={reveal}
            onOpen={(s) => setOpen(s.id)}
            onReorder={(ids) => (offer('Step moved'), state.reorder(journey.id, ids))}
            onAdd={(s, at) => state.addStep(journey.id, s, at)}
          />
        </div>
      )}

      {/* The legend for the dot on every card, pinned to the bottom right of the screen, outside the scrolling line. */}
      {upNext ? null : (
        <ul
          aria-label="What the dots mean"
          className="flex flex-wrap items-center gap-4 type-body text-zebra-500 md:absolute md:right-6 md:bottom-5"
        >
          {(['auto', 'them', 'you'] as const).map((w) => (
            <li key={w} className="flex items-center gap-2 whitespace-nowrap">
              <span aria-hidden="true" className={`size-2.5 rounded-pill ${WAIT_DOT[w]}`} />
              {WAIT_LABEL[w]}
            </li>
          ))}
        </ul>
      )}

      {/* Pinned to the bottom of the window: a removed step is often far down the line, below the fold.
          There is no shared toast primitive yet, so this one is local, on the floating surface every menu shares. */}
      {undo ? (
        <div
          role="status"
          className={`${FLOATING} fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-panel py-1 pr-1 pl-4 type-body text-zebra-700`}
        >
          <span>{undo.says}</span>
          <Button variant="plain" onClick={() => (state.restore(undo.before), setUndo(null))}>
            Undo
          </Button>
        </div>
      ) : null}

      <StepDialog
        key={step?.id ?? 'closed'}
        journey={journey}
        step={step}
        onChange={(s) => state.updateStep(journey.id, s)}
        onEdit={edit}
        onRemove={(s) => {
          setOpen(null);
          offer(`${s.name} removed`);
          state.removeStep(journey.id, s.id);
        }}
        onClose={() => setOpen(null)}
      />
      <TemplateEditor
        key={editing ?? 'editor-closed'}
        id={editing}
        onClose={() => setEditing(null)}
      />
      <NewJourneyDialog
        key={naming ? 'naming' : 'naming-closed'}
        open={naming}
        journeys={journeys}
        onClose={() => setNaming(false)}
        onCreate={(name, from) => {
          setNaming(false);
          setCurrent(state.create(name, from));
        }}
      />
      <AddClientDialog
        key={adding ? `adding-${journey.id}` : 'adding-closed'}
        open={adding}
        journey={journey}
        journeys={journeys}
        onClose={() => setAdding(false)}
        onAdd={(client, at) => (
          setAdding(false),
          state.addPerson(journey.id, { ...client, step: at })
        )}
      />
    </PageFrame>
  );
}
