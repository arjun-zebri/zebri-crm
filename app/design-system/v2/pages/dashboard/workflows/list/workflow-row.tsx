import { CircleCheck, CircleX } from 'lucide-react';

import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Switch } from '@/components/ui-v2/switch';

import { ROW } from '../../payments/invoice-row';
import type { Workflow } from '../model';

import { StepChain } from './step-chain';

/**
 * One workflow in the list: its name over what starts it; what it does,
 * step by step, in the flexible middle; how many clients are part-way
 * through; whether it is healthy; and the On switch, the one control a
 * row needs. Clicking anywhere else opens the builder.
 *
 * The health column leads with a tick when all is well (then when it
 * last sent, and how much this week) and a cross when something needs
 * the MC: a bounce, a lost connection. An Off workflow fades in place and
 * says since when, or that it has never run.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/list/workflow-row
 */

export interface WorkflowRowProps {
  workflow: Workflow;
  /** What starts it, in words (see `workflowTriggerLine`). */
  trigger: string;
  workflowName: (id: string) => string;
  onOpen: () => void;
  onToggle: (on: boolean) => void;
}

/** The health column's two lines: the headline, then the detail. */
function health(w: Workflow): { text: string; detail: string; alert: boolean } {
  if (w.issue) return { text: w.issue.text, detail: w.issue.who, alert: true };
  if (w.finishing) return { text: 'Finishing up', detail: 'Taking no new clients', alert: false };
  if (!w.on) return { text: w.offSince ? `Off since ${w.offSince}` : 'Never run', detail: '', alert: false };
  return {
    text: w.lastSent ? `Last sent ${w.lastSent}` : 'Nothing sent yet',
    detail: w.sentThisWeek ? `${w.sentThisWeek} send${w.sentThisWeek === 1 ? '' : 's'} this week` : '',
    alert: false,
  };
}

/** A workflow row. See {@link WorkflowRowProps}. */
export function WorkflowRow({ workflow: w, trigger, workflowName, onOpen, onToggle }: WorkflowRowProps) {
  const h = health(w);
  const n = w.clients.length;
  const tone = w.on ? '' : ' opacity-60';
  return (
    <li>
      <div className={`${ROW} grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(10rem,16rem)_minmax(0,1fr)_8rem_12.5rem_2.25rem]`}>
        <StretchedButton label={`Open ${w.name}`} onClick={onOpen}>
          <span className={`block truncate type-label text-zebra-950${tone}`}>{w.name}</span>
          <span className={`block truncate type-body text-zebra-500${tone}`}>{trigger}</span>
          {/* Phones have no health column, so a problem rides under the name. */}
          {h.alert ? <span className="block truncate type-body text-danger lg:hidden">{`${h.text} · ${h.detail}`}</span> : null}
        </StretchedButton>
        <span className={`hidden min-w-0 lg:block${tone}`}>
          <StepChain steps={w.steps} workflowName={workflowName} />
        </span>
        <span className={`hidden type-body tabular-nums lg:block ${n ? 'text-zebra-700' : 'text-zebra-400'}`}>{n ? `${n} in progress` : 'Nobody on it'}</span>
        <span className="hidden min-w-0 gap-2 lg:flex">
          {/* Off rows get no mark, only the space, so every line of text
              starts in the same place. */}
          <span className="flex h-lh shrink-0 items-center type-body">
            {h.alert ? (
              <CircleX aria-label="Needs you" strokeWidth={1.5} className="size-4 text-danger" />
            ) : w.on ? (
              <CircleCheck aria-label="Working" strokeWidth={1.5} className="size-4 text-grass-600" />
            ) : (
              <span className="size-4" />
            )}
          </span>
          <span className="min-w-0 type-body">
            <span className={`block truncate tabular-nums ${h.alert ? 'text-danger' : w.on ? 'text-zebra-700' : 'text-zebra-500'}`}>{h.text}</span>
            {h.detail ? <span className="block truncate tabular-nums text-zebra-500">{h.detail}</span> : null}
          </span>
        </span>
        <span className="relative z-10 flex justify-end">
          <Switch checked={w.on} onChange={onToggle} aria-label={`${w.name} ${w.on ? 'on' : 'off'}`} />
        </span>
      </div>
    </li>
  );
}
