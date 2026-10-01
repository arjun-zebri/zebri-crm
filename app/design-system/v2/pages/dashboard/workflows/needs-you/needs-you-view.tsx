'use client';

import { useState } from 'react';

import { RowSections } from '@/components/ui-v2/row-sections';

import { flatSteps, type Workflow } from '../model';
import { QUEUE_SECTIONS, groupOf, type QueueItem } from '../queue-data';
import type { WorkflowsState } from '../use-workflows-state';
import type { Draft } from '../zebri-chat';

import { ApproveRow } from './approve-row';
import { ReviewDialog } from './review-dialog';
import { ScheduledRow, type ScheduledMove } from './scheduled-row';
import { TodoRow } from './todo-row';

/**
 * The Up next tab: the queue in sections by what needs the MC. Needs
 * your action first (a late to-do, sends waiting for an OK, the MC's
 * to-dos), then what Zebri sends by itself today and later, with Done
 * folded away. Nothing sends straight from a row: Send opens the
 * message to read first. Empty sections do not show. A line at the top says so when nothing needs the
 * MC at all, which is the state a good week ends in.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/needs-you/needs-you-view
 */

// Stand-ins for the variables a scheduled message has not filled in yet.
const FILL: Record<string, string> = {
  'event date': 'your day', venue: 'the venue', 'booking link': 'zebri.app/b/arjun', 'portal link': 'zebri.app/p/4410',
  'questionnaire link': 'zebri.app/q/2291', balance: '$1,650', 'due date': 'Friday', 'invoice link': 'zebri.app/i/4821',
  'arrival time': '2:30pm', 'review link': 'zebri.app/review/arjun',
};

/** The message a queued send will go out with, written for its client. */
function draftFor(item: QueueItem, workflows: Workflow[]): Draft {
  if (item.draft) return item.draft;
  const step = workflows.flatMap((w) => flatSteps(w.steps)).find((s) => s.kind === 'email' && s.subject === item.label);
  const body = step?.kind === 'email' ? step.body : `Hi {{first names}},\n\n${item.label}.\n\nSpeak soon,\nArjun`;
  return {
    subject: item.label,
    body: body.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => (k === 'first names' ? item.names.join(' and ') : (FILL[k] ?? k))),
  };
}

export interface NeedsYouViewProps {
  state: WorkflowsState;
  onOpenWorkflow: (id: string) => void;
}

/** The Up next tab. See {@link NeedsYouViewProps}. */
export function NeedsYouView({ state, onOpenWorkflow }: NeedsYouViewProps) {
  const [reading, setReading] = useState<string | null>(null);
  const item = state.queue.find((i) => i.id === reading) ?? null;
  const calm = !state.queue.some((i) => (i.section === 'approve' || i.section === 'todo') && !i.outcome);

  const move = (i: QueueItem, m: ScheduledMove) => {
    if (m === 'read' || m === 'send') setReading(i.id);
    else if (m === 'skip') state.settle(i.id, 'Skipped by you');
    else if (m === 'pause') state.settle(i.id, `Paused for ${i.names.join(' & ')}`);
    else onOpenWorkflow(i.workflow);
  };

  return (
    <>
      {calm ? <p className="px-3 pb-4 type-lead text-zebra-500">Nothing needs you. Zebri has the rest.</p> : null}
      <RowSections
        sections={QUEUE_SECTIONS}
        items={state.queue}
        sectionOf={groupOf}
        renderRow={(i) => {
          const workflow = state.workflowName(i.workflow);
          if (i.section === 'approve')
            return <ApproveRow key={i.id} item={i} workflow={workflow} sending={state.sending.has(i.id)} onOpen={() => setReading(i.id)} />;
          if (i.section === 'todo')
            return <TodoRow key={i.id} item={i} workflow={workflow} onTick={() => state.settle(i.id, 'Done by you')} onUndo={() => state.reopen(i.id)} />;
          return <ScheduledRow key={i.id} item={i} workflow={workflow} onMove={(m) => move(i, m)} />;
        }}
      />
      <ReviewDialog
        key={reading ?? 'none'}
        item={item}
        draft={item ? draftFor(item, state.workflows) : null}
        workflow={item ? state.workflowName(item.workflow) : ''}
        sending={item ? state.sending.has(item.id) : false}
        onClose={() => setReading(null)}
        onSkip={() => {
          if (item) state.settle(item.id, 'Skipped by you');
          setReading(null);
        }}
        onSend={(d) => {
          if (!item) return;
          state.send(item.id, d);
          window.setTimeout(() => setReading(null), 700);
        }}
      />
    </>
  );
}
