'use client';

import { useDeferredValue, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { ClientsIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';
import { PillTabs } from '@/components/ui-v2/pill-tabs';

import { useAccount } from '../account';
import { PageBar } from '../page-bar';
import { PageFrame } from '../page-frame';

import { BoardView } from './board-view';
import { clientName, inScope, type Heat, type Scope } from './clients-data';
import { ClientsToolbar } from './clients-toolbar';
import { ForYouView } from './for-you-view';
import { ListView } from './list-view';
import { NewClientDialog } from './new-client-dialog';
import { ClientProfile } from './profile/client-profile';
import type { ProfileStart } from './profile/profile-body';
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
const VIEWS: readonly View[] = ['for-you', 'board', 'list'];

export interface ClientsPageProps {
  /** h2 inside a showroom frame. */
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons, at the end of the title row. */
  actions?: ReactNode;
  /** Opens on New client: Home's next move. */
  startNew?: boolean | undefined;
  /**
   * Opens with this client's profile up: on a document when one is named
   * (Show me on the run sheet), else on Overview (a calendar item).
   */
  openOn?: ({ id: string } & Partial<ProfileStart>) | undefined;
}

/** The Clients page. See {@link ClientsPageProps}. */
export function ClientsPage({
  heading: Heading = 'h1',
  actions,
  startNew = false,
  openOn,
}: ClientsPageProps) {
  const [view, setView] = useState<View>('for-you');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('Everyone');
  const [heats, setHeats] = useState<Heat[]>([]);
  const moves = useNextMoves();
  const [openId, setOpenId] = useState<string | null>(openOn?.id ?? null);
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
    <PageFrame
      labelledBy="clients-title"
      bar={
        <PageBar
          title={
            <Heading id="clients-title" className="sr-only">
              Clients
            </Heading>
          }
          tabs={
            <PillTabs
              label="View"
              options={VIEWS}
              labels={{ 'for-you': 'For you', board: 'Board', list: 'List' }}
              counts={{ 'for-you': needs }}
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
      }
    >
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col">
          {clients.length === 0 ? (
            <EmptyState
              icon={ClientsIcon}
              title="No clients yet"
              body="Everyone you work with, and their event, lives here."
            />
          ) : shown.length === 0 ? (
            <Panel>
              <EmptyState
                compact
                title="No clients match"
                body="Nobody fits that search and those filters."
                action={
                  <Button variant="secondary" onClick={reset}>
                    Clear search and filters
                  </Button>
                }
              />
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
        opening={
          openOn?.doc !== undefined && openOn.id === openId
            ? { doc: openOn.doc, intro: openOn.intro ?? false }
            : undefined
        }
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
    </PageFrame>
  );
}
