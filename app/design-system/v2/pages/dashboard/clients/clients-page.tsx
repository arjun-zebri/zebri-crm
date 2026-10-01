'use client';

import { useDeferredValue, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';
import { Tabs, tabId } from '@/components/ui-v2/tabs';

import { useAccount } from '../account';
import { EmptyState } from '../empty-state';
import { PageBar } from '../page-bar';

import { BoardView } from './board-view';
import { clientName, inScope, type Heat, type Scope } from './clients-data';
import { ClientsToolbar } from './clients-toolbar';
import { ForYouView } from './for-you-view';
import { ListView } from './list-view';
import { NewClientDialog } from './new-client-dialog';
import { ClientProfile } from './profile/client-profile';
import { useNextMoves } from './use-next-moves';

/**
 * The v2 Clients page, shown when Clients is picked in the dashboard
 * sidebar: a title with the total, the toolbar, and three views of the
 * same clients. For you sorts them by what needs the MC, Board lays
 * them out by stage, List is the plain table. Search, scope and filter
 * apply to all three; a move sent in one view is done in the others.
 * The title and toolbar sit on the backdrop; the rows are on glass
 * (a panel per For you section, the board's columns, the list's
 * table), so the grass and sky show between them. Chrome is two
 * lines: the title with the dashboard's icons, then the view tabs with
 * the toolbar. The clients are the account's (`useAccount`): the demo
 * business by default. New client works when the account can add one;
 * an account with no clients yet gets an empty state instead of views.
 *
 * @module app/design-system/v2/pages/dashboard/clients/clients-page
 */

type View = 'for-you' | 'board' | 'list';
const VIEW_ID = 'clients-view';

export interface ClientsPageProps {
  /** h2 inside a showroom frame. */
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons, at the end of the title row. */
  actions?: ReactNode;
  /** Opens on New client: Home's next move. */
  startNew?: boolean | undefined;
}

/** The Clients page. See {@link ClientsPageProps}. */
export function ClientsPage({ heading: Heading = 'h1', actions, startNew = false }: ClientsPageProps) {
  const [view, setView] = useState<View>('for-you');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('Everyone');
  const [heats, setHeats] = useState<Heat[]>([]);
  const moves = useNextMoves();
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());
  const account = useAccount();
  const { clients } = account;
  const [adding, setAdding] = useState(startNew ? 1 : 0);
  const add = account.addClient;

  const shown = clients.filter(
    (c) =>
      inScope(c, scope) &&
      (heats.length === 0 || heats.includes(c.heat)) &&
      (q === '' || `${clientName(c)} ${c.venue}`.toLowerCase().includes(q)),
  );
  const needs = clients.filter((c) => c.group === 'needs' && !moves.done.has(c.id)).length;
  const reset = () => {
    setQuery('');
    setScope('Everyone');
    setHeats([]);
  };

  return (
    // No sheet behind the page: the title and toolbar sit on the
    // backdrop and only the clients themselves are on glass, as on Home.
    // Full width, so a wide screen shows more, not more margin.
    <section
      aria-labelledby="clients-title"
      className="flex flex-1 flex-col px-3 pb-8 md:py-3 md:pl-5 md:pr-2"
    >
      <div className="flex flex-1 flex-col gap-6">
        <PageBar
          title={
            <div className="flex items-baseline gap-3">
              <Heading id="clients-title" className="type-title text-zebra-950">
                Clients
              </Heading>
              <span className="type-body tabular-nums text-zebra-400">{clients.length}</span>
            </div>
          }
          tabs={
            <Tabs
              id={VIEW_ID}
              label="View"
              items={[
                { value: 'for-you', label: 'For you', count: needs },
                { value: 'board', label: 'Board' },
                { value: 'list', label: 'List' },
              ]}
              value={view}
              onChange={setView}
            />
          }
          toolbar={
            <ClientsToolbar
              query={query}
              onQuery={setQuery}
              scope={scope}
              onScope={setScope}
              heats={heats}
              onHeats={setHeats}
              clients={clients}
              onNew={add ? () => setAdding((n) => n + 1) : undefined}
            />
          }
          actions={actions}
        />
        <div role="tabpanel" aria-labelledby={tabId(VIEW_ID, view)} className="flex flex-1 flex-col">
          {clients.length === 0 ? (
            <EmptyState title="No clients yet" body="Everyone you work with, and their event, lives here." />
          ) : shown.length === 0 ? (
            <Panel className="space-y-3 py-16 text-center">
              <p className="type-body text-zebra-500">No clients match that search.</p>
              <Button variant="secondary" onClick={reset}>
                Clear search and filters
              </Button>
            </Panel>
          ) : view === 'for-you' ? (
            <ForYouView clients={shown} moves={moves} onOpen={setOpenId} />
          ) : view === 'board' ? (
            <BoardView clients={shown} moves={moves} onOpen={setOpenId} />
          ) : (
            <ListView clients={shown} moves={moves} onOpen={setOpenId} />
          )}
        </div>
      </div>
      <ClientProfile
        client={clients.find((c) => c.id === openId) ?? null}
        moves={moves}
        onClose={() => setOpenId(null)}
      />
      {add ? (
        // `adding` counts openings, so each one starts with an empty form.
        <NewClientDialog
          key={adding}
          open={adding > 0}
          onClose={() => setAdding(0)}
          onAdd={(c) => {
            add(c);
            setAdding(0);
          }}
        />
      ) : null}
    </section>
  );
}
