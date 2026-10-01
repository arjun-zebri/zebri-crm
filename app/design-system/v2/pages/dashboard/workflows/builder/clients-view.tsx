import { Button } from '@/components/ui-v2/button';

import { shortDate } from '../../payments/dates';
import { CoupleAvatars, ROW } from '../../payments/invoice-row';
import { coupleName } from '../../payments/payments-data';
import { stepTitle, timingWords, type Workflow } from '../model';
import { triggerOf } from '../triggers';

/**
 * Who is on this workflow and how far along each is: their own copy of
 * the steps, so "Step 3 of 7" and what comes next, in words. Pause stops
 * it for that one client (the rest carry on) and hands over to Resume.
 * Editing the workflow never touches a copy already running.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/clients-view
 */

export interface ClientsViewProps {
  workflow: Workflow;
  workflowName: (id: string) => string;
  onPause: (index: number, paused: boolean) => void;
}

/** The Clients view. See {@link ClientsViewProps}. */
export function ClientsView({ workflow: w, workflowName, onPause }: ClientsViewProps) {
  if (w.clients.length === 0)
    return (
      <p className="px-3 py-6 type-body text-zebra-500">
        No clients on it yet. It starts for a client when {triggerOf(w.trigger.id).words}
        {w.on ? '.' : ', once it is on.'}
      </p>
    );
  return (
    <ul>
      {w.clients.map((c, i) => {
        const next = w.steps[c.at];
        return (
          <li key={coupleName(c.names)}>
            <div className={`${ROW} cursor-default grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_6rem]`}>
              <div className="flex min-w-0 items-center gap-3">
                <CoupleAvatars names={c.names} />
                <div className="min-w-0">
                  <span className="block truncate type-label text-zebra-950">{coupleName(c.names)}</span>
                  <span className="block truncate type-body text-zebra-500">{c.event ? shortDate(c.event) : 'No date yet'}</span>
                </div>
              </div>
              <p className="col-span-full row-start-2 truncate pl-[4.25rem] type-body lg:col-span-1 lg:row-start-auto lg:pl-0">
                <span className="text-zebra-950">
                  Step {Math.min(c.at + 1, w.steps.length)} of {w.steps.length}
                </span>
                <span className="text-zebra-500">
                  {c.paused ? ' · Paused' : next ? ` · Next: ${next.kind === 'email' ? next.subject : stepTitle(next, workflowName)}, ${timingWords(next.timing).toLowerCase()}` : ' · Finished'}
                </span>
              </p>
              <div className="col-start-2 row-start-1 flex justify-end lg:col-start-3">
                <Button variant="plain" onClick={() => onPause(i, !c.paused)}>
                  {c.paused ? 'Resume' : 'Pause'}
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
