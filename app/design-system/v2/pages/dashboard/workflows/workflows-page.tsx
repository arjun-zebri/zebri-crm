'use client';

import { Plus, Search } from 'lucide-react';
import { useDeferredValue, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Input } from '@/components/ui-v2/input';
import { Tabs, tabId } from '@/components/ui-v2/tabs';

import { PageBar } from '../page-bar';

import { Builder } from './builder/builder';
import { WorkflowsList } from './list/workflows-list';
import { NeedsYouView } from './needs-you/needs-you-view';
import { NewWorkflowDialog } from './new/new-workflow-dialog';
import { useWorkflowsState } from './use-workflows-state';
import { buildWorkflow } from './zebri-build';

/**
 * The v2 Workflows page, shown when Workflows is picked in the dashboard
 * sidebar. It opens on Up next, because the MC's question in the
 * morning is "what do I do", not "how is my automation set up": sends
 * waiting for an OK (each already written for its client, one click to
 * send), their own to-dos, then what Zebri sends by itself. All
 * workflows is the list, with Zebri's one suggestion when it has one. New
 * workflow (on that tab only) starts from a sentence; a row opens the
 * builder in place of the page.
 * All content is demo data.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/workflows-page
 */

const TAB_ID = 'workflows-tab';
const SEARCH_AFTER = 8;
type Tab = 'needs' | 'workflows';

export interface WorkflowsPageProps {
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons, at the end of the title row. */
  actions?: ReactNode;
}

/** The Workflows page. See {@link WorkflowsPageProps}. */
export function WorkflowsPage({ heading: Heading = 'h1', actions }: WorkflowsPageProps) {
  const state = useWorkflowsState();
  const [tab, setTab] = useState<Tab>('needs');
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLowerCase());
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<{ id: string; fresh: boolean } | null>(null);

  const build = (description: string) => {
    const w = buildWorkflow(description || 'blank', description ? undefined : 'New workflow');
    state.add(description ? w : { ...w, trigger: { id: 'manual', filters: [] }, steps: [] });
    setCreating(false);
    setOpen({ id: w.id, fresh: Boolean(description) });
  };

  const editing = open ? state.workflows.find((w) => w.id === open.id) : undefined;
  if (open && editing)
    return <Builder key={editing.id} workflow={editing} state={state} fresh={open.fresh} onOpen={(id) => setOpen({ id, fresh: false })} onBack={() => setOpen(null)} />;

  const waiting = state.queue.filter((i) => (i.section === 'approve' || i.section === 'todo') && !i.outcome).length;
  return (
    <section aria-labelledby="workflows-title" className="flex flex-1 flex-col px-3 md:py-3 md:pl-5 md:pr-2">
      <PageBar
        title={
          <Heading id="workflows-title" className="type-title text-zebra-950">
            Workflows
          </Heading>
        }
        tabs={
          <Tabs
            id={TAB_ID}
            label="Workflows"
            items={[
              { value: 'needs', label: 'Up next', count: waiting, countOf: { word: 'need you', tone: 'warning' } },
              // No count here: beside Up next's "need you" count, a count
              // of workflows read as the same kind of number and seemed
              // to disagree with it.
              { value: 'workflows', label: 'All workflows' },
            ]}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setQuery('');
            }}
          />
        }
        toolbar={
          <>
            {/* Setting up is the All workflows tab's job. On Up next the
                work is clearing the queue, so nothing here outweighs Send. */}
            {tab === 'workflows' ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* A handful of workflows fit on one screen; search earns
                    its place only once the list scrolls. */}
                {state.workflows.length > SEARCH_AFTER ? (
                  <div className="w-full sm:w-52">
                    <Input type="search" aria-label="Search workflows" placeholder="Search workflows" value={query} onChange={(e) => setQuery(e.target.value)} leading={<Search strokeWidth={1.5} className="size-4" />} />
                  </div>
                ) : null}
                <Button onClick={() => setCreating(true)}>
                  <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
                  New workflow
                </Button>
              </div>
            ) : null}
          </>
        }
        actions={actions}
      />
      {/* Full width like every other page. The rows keep each time next
          to its button (see needs-you/queue-row.ts), so the width goes to
          Zebri's why line rather than to a gap before the button. */}
      <div className="flex w-full flex-1 flex-col">
        <div role="tabpanel" aria-labelledby={tabId(TAB_ID, tab)} className="mt-6 flex-1 pb-8">
          {tab === 'needs' ? (
            <NeedsYouView state={state} onOpenWorkflow={(id) => setOpen({ id, fresh: false })} />
          ) : (
            <WorkflowsList state={state} query={q} onOpen={(id) => setOpen({ id, fresh: false })} onBuild={build} />
          )}
        </div>
      </div>
      <NewWorkflowDialog open={creating} onClose={() => setCreating(false)} onBuild={build} />
    </section>
  );
}
