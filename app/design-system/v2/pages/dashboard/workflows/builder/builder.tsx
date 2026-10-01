'use client';

import { useState } from 'react';

import { Dialog } from '@/components/ui-v2/dialog';
import { Panel } from '@/components/ui-v2/panel';
import { Segmented } from '@/components/ui-v2/segmented';

import { useBackdropDim } from '../../backdrop-dim';
import { useTurnOff } from '../list/use-turn-off';
import {
  flatSteps,
  insertStep,
  mapStep,
  removeStep,
  uid,
  type Enrolment,
  type Workflow,
} from '../model';
import type { WorkflowsState } from '../use-workflows-state';

import { BuilderHeader } from './builder-header';
import { BuiltNote } from './built-note';
import { ClientsView } from './clients-view';
import { StepPanel } from './step-panel';
import { Story } from './story';
import { testDates } from './test-dates';
import { usePanelMotion } from './use-panel-motion';
import { useWide } from './use-wide';

/**
 * The workflow builder, in place of the page: the story in one column,
 * the picked step's detail beside it (a full-screen dialog on phones).
 * A workflow Zebri has just built opens with one line saying what to
 * check before turning it on.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/builder
 */

// Nothing washes green without the Ask bar; the story still takes the set.
const NONE: ReadonlySet<string> = new Set();

export interface BuilderProps {
  workflow: Workflow;
  state: WorkflowsState;
  /** Zebri built it just now: say what to check. */
  fresh: boolean;
  onOpen: (id: string) => void;
  onBack: () => void;
}

/** The builder. See {@link BuilderProps}. */
export function Builder({ workflow: w, state, fresh, onOpen, onBack }: BuilderProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'Steps' | 'Clients'>('Steps');
  const [testing, setTesting] = useState<Enrolment | null>(null);
  const [note, setNote] = useState(fresh);
  const wide = useWide();
  const turnOff = useTurnOff(state);

  // The last thing picked stays mounted while the side column closes, so
  // the panel eases out with its content instead of emptying first.
  const [kept, setKept] = useState<string | null>(null);
  if (selected !== null && selected !== kept) setKept(selected);
  const shown = selected ?? kept;
  const open = selected !== null;
  const { mounted, columnRef, anchorRef, panelRef } = usePanelMotion(open && wide);
  // A faint shade on the app backdrop while the panel is up, to lift it.
  useBackdropDim(open && wide);

  const edit = (fn: (x: Workflow) => Workflow) => state.update(w.id, fn);
  const step =
    shown && shown !== 'trigger' ? (flatSteps(w.steps).find((s) => s.id === shown) ?? null) : null;
  const emails = flatSteps(w.steps).filter((s) => s.kind === 'email').length;

  const panel =
    shown !== null && (step || shown === 'trigger') ? (
      <StepPanel
        workflow={w}
        step={step}
        others={state.workflows.filter((o) => o.id !== w.id)}
        onTrigger={(trigger) => edit((x) => ({ ...x, trigger }))}
        onStep={(s) => edit((x) => ({ ...x, steps: mapStep(x.steps, s.id, () => s) }))}
        onRemove={() => {
          edit((x) => ({ ...x, steps: removeStep(x.steps, shown) }));
          setSelected(null);
        }}
        onClose={() => setSelected(null)}
      />
    ) : null;

  return (
    <section aria-label={w.name} className="flex flex-1 flex-col px-3 md:py-3 md:pl-5 md:pr-2">
      <BuilderHeader
        workflow={w}
        testing={testing}
        onBack={onBack}
        onRename={(name) => edit((x) => ({ ...x, name }))}
        onToggle={(on) => turnOff.toggle(w, on)}
        onTest={setTesting}
        onDuplicate={() => {
          const copy = {
            ...w,
            id: uid('wf'),
            name: `${w.name} copy`,
            on: false,
            clients: [],
            sentThisWeek: 0,
          };
          state.add(copy);
          onOpen(copy.id);
        }}
        onDelete={() => {
          state.remove(w.id);
          onBack();
        }}
      />
      {note ? <BuiltNote emails={emails} onDismiss={() => setNote(false)} /> : null}
      <div className="mt-5 flex flex-1">
        <div ref={columnRef} className="flex min-w-0 flex-1 flex-col">
          <div ref={anchorRef} className="mx-auto w-full max-w-2xl flex-1 space-y-4">
            <div className="px-3">
              <Segmented
                label="View"
                options={['Steps', 'Clients'] as const}
                value={view}
                onChange={setView}
                counts={{ Clients: w.clients.length }}
              />
            </div>
            {view === 'Steps' ? (
              <Story
                workflow={w}
                selected={selected}
                changed={NONE}
                dates={testing ? testDates(w.steps, testing) : null}
                workflowName={state.workflowName}
                onSelect={setSelected}
                onInsert={(parent, index, s) => {
                  edit((x) => ({ ...x, steps: insertStep(x.steps, parent, index, s) }));
                  setSelected(s.id);
                }}
              />
            ) : (
              <ClientsView
                workflow={w}
                workflowName={state.workflowName}
                onPause={(i, paused) =>
                  edit((x) => ({
                    ...x,
                    clients: x.clients.map((c, j) => (j === i ? { ...c, paused } : c)),
                  }))
                }
              />
            )}
          </div>
        </div>
        {wide && mounted ? (
          // Stays mounted while the panel slides out; see usePanelMotion.
          <div inert={!open} className="relative z-20 shrink-0 pl-6">
            <Panel
              ref={panelRef}
              as="aside"
              aria-labelledby="step-panel-title"
              className="sticky top-3 max-h-[calc(100dvh-1.5rem)] w-[28rem] overflow-hidden shadow-lg ring-1 ring-zebra-950/5"
            >
              {panel}
            </Panel>
          </div>
        ) : null}
      </div>
      {!wide ? (
        <Dialog
          open={open && panel !== null}
          onClose={() => setSelected(null)}
          size="md"
          aria-labelledby="step-panel-title"
        >
          {panel}
        </Dialog>
      ) : null}
      {turnOff.dialog}
    </section>
  );
}
