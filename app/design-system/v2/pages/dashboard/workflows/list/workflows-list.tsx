'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';
import { RowSections, type RowSection } from '@/components/ui-v2/row-sections';

import { workflowTriggerLine } from '../triggers';
import type { WorkflowsState } from '../use-workflows-state';
import { STARTERS, SUGGESTION } from '../zebri-chat';

import { useTurnOff } from './use-turn-off';
import { WorkflowRow } from './workflow-row';

/**
 * The All workflows tab: every workflow in one list, On first, then Off
 * (drafts Zebri built land there until the MC turns them on). Above
 * them, at most one suggestion from Zebri, on a white card with the AI
 * grass-to-sky hairline, sized to its words rather than the page, and
 * only while it is true: a job the MC keeps doing by hand that
 * a workflow could take. Set it up builds the workflow and opens it;
 * Not now puts it away for the visit.
 *
 * The order is fixed when the tab opens: flipping a switch fades the row
 * where it is rather than jumping it to the other end of the list, and
 * the list re-sorts next time. Past {@link GROUP_AFTER} workflows the
 * list splits under On and Off headings; fewer than that, headings are
 * more furniture than help. With no workflows at all, the starters build
 * one in a click, so the tab is never a blank page.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/list/workflows-list
 */

const GROUP_AFTER = 8;

type Group = 'on' | 'off';

const GROUPS: RowSection<Group>[] = [
  { id: 'on', title: 'On', dot: 'bg-grass-500' },
  { id: 'off', title: 'Off', dot: 'bg-zebra-300' },
];

export interface WorkflowsListProps {
  state: WorkflowsState;
  query: string;
  onOpen: (id: string) => void;
  /** Builds a workflow from a description and opens it. */
  onBuild: (description: string) => void;
}

/** The All workflows tab. See {@link WorkflowsListProps}. */
export function WorkflowsList({ state, query, onOpen, onBuild }: WorkflowsListProps) {
  const turnOff = useTurnOff(state);
  // Whether each workflow was on when the tab opened: the sort key.
  const [wasOn] = useState(() => new Map(state.workflows.map((w) => [w.id, w.on])));
  // Built this visit: not in the map, so first, where the MC expects it.
  const rank = (id: string) => (wasOn.has(id) ? (wasOn.get(id) ? 1 : 2) : 0);
  const rows = state.workflows
    .filter((w) => query === '' || w.name.toLowerCase().includes(query))
    .sort((a, b) => rank(a.id) - rank(b.id));
  // True only while no workflow already chases overdue invoices.
  const gap = !state.workflows.some((w) => w.trigger.id === SUGGESTION.trigger);

  const row = (w: (typeof rows)[number]) => (
    <WorkflowRow
      key={w.id}
      workflow={w}
      trigger={workflowTriggerLine(w, state.workflows)}
      workflowName={state.workflowName}
      onOpen={() => onOpen(w.id)}
      onToggle={(on) => turnOff.toggle(w, on)}
    />
  );

  if (state.workflows.length === 0) return <Starters onBuild={onBuild} />;
  return (
    <div className="space-y-6">
      {!state.suggestionDismissed && gap && query === '' ? (
        <Panel tone="highlight" className="flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 shadow-sm">
          <p className="min-w-48 flex-1 type-body text-zebra-950">{SUGGESTION.text}</p>
          <div className="flex items-center gap-2">
            <Button variant="plain" onClick={state.dismissSuggestion}>
              Not now
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                state.dismissSuggestion();
                onBuild(SUGGESTION.description);
              }}
            >
              Set it up
            </Button>
          </div>
        </Panel>
      ) : null}
      {rows.length === 0 ? (
        <p className="px-3 type-body text-zebra-500">No workflow matches that search.</p>
      ) : state.workflows.length > GROUP_AFTER ? (
        <RowSections sections={GROUPS} items={rows} sectionOf={(w) => (rank(w.id) === 2 || (rank(w.id) === 0 && !w.on) ? 'off' : 'on')} renderRow={row} />
      ) : (
        <Panel className="p-2">
          <ul>{rows.map(row)}</ul>
        </Panel>
      )}
      {turnOff.dialog}
    </div>
  );
}

/** The tab with no workflows: an MC's usual year, one click each. */
function Starters({ onBuild }: { onBuild: (description: string) => void }) {
  return (
    <div className="max-w-xl space-y-4 px-3 py-6">
      <div className="space-y-1">
        <h2 className="type-subheading text-zebra-950">Start with the ones most MCs use</h2>
        <p className="type-body text-zebra-500">Zebri writes every email in your voice. Nothing sends until you turn it on.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {STARTERS.map((s) => (
          <Button key={s.label} variant="secondary" onClick={() => onBuild(s.text)}>
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
