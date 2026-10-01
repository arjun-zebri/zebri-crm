'use client';

import { useEffect, useRef, useState } from 'react';

import type { Workflow } from './model';
import { SEED_QUEUE, type QueueItem } from './queue-data';
import { SEED_WORKFLOWS } from './workflows-seed';
import type { Draft } from './zebri-chat';

/**
 * What the MC has done on the Workflows page this visit: sends approved,
 * to-dos ticked, workflows switched on, built or edited. Shared by both
 * tabs and the builder, so a workflow turned on in the builder shows as
 * On in the list. Demo only: nothing is saved, a reload starts over.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/use-workflows-state
 */

/** Long enough to read as work happening, short enough not to wait on. */
const SEND_MS = 700;
/** How long a settled row shows its tick before it folds into Done. */
const LINGER_MS = 1400;

export interface WorkflowsState {
  workflows: Workflow[];
  queue: QueueItem[];
  /** Queue ids mid-send. */
  sending: ReadonlySet<string>;
  workflowName: (id: string) => string;
  update: (id: string, fn: (w: Workflow) => Workflow) => void;
  add: (w: Workflow) => void;
  remove: (id: string) => void;
  /** Sends a queued message, with the MC's edits if any. */
  send: (id: string, draft?: Draft) => void;
  /** Marks a queue item with what happened, then folds it into Done. */
  settle: (id: string, outcome: string) => void;
  /** Undoes a tick, before or after it folds away: back to the to-dos. */
  reopen: (id: string) => void;
  /** Zebri's suggestion was put away (Not now, or Set it up) this visit. */
  suggestionDismissed: boolean;
  dismissSuggestion: () => void;
}

/** Workflows page state. See {@link WorkflowsState}. */
export function useWorkflowsState(): WorkflowsState {
  const [workflows, setWorkflows] = useState<Workflow[]>(SEED_WORKFLOWS);
  const [queue, setQueue] = useState<QueueItem[]>(SEED_QUEUE);
  const [sending, setSending] = useState<ReadonlySet<string>>(() => new Set());
  // Held here, not in the list, so switching tabs doesn't bring it back.
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  // The row shows its outcome in place first, then folds into Done, so
  // nothing leaves from under the pointer the moment it is clicked.
  const settle = (id: string, outcome: string) => {
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, outcome } : i)));
    later(() => setQueue((q) => q.map((i) => (i.id === id && i.outcome ? { ...i, section: 'done', when: 'Just now' } : i))), LINGER_MS);
  };

  return {
    workflows,
    queue,
    sending,
    workflowName: (id) => workflows.find((w) => w.id === id)?.name ?? 'a workflow',
    update: (id, fn) => setWorkflows((ws) => ws.map((w) => (w.id === id ? fn(w) : w))),
    add: (w) => setWorkflows((ws) => [w, ...ws]),
    remove: (id) => setWorkflows((ws) => ws.filter((w) => w.id !== id)),
    send(id, draft) {
      setSending((s) => new Set(s).add(id));
      later(() => {
        setQueue((q) => q.map((i) => (i.id === id ? { ...i, draft: draft ?? i.draft } : i)));
        settle(id, 'Sent by you');
        setSending((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, SEND_MS);
    },
    settle,
    suggestionDismissed,
    dismissSuggestion: () => setSuggestionDismissed(true),
    reopen: (id) => setQueue((q) => q.map((i) => (i.id === id ? { ...i, section: 'todo', outcome: undefined } : i))),
  };
}
