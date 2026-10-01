'use client';

import { ListFilter, Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { Input } from '@/components/ui-v2/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { HEATS, SCOPES, inScope, type Client, type Heat, type Scope } from './clients-data';

/**
 * The Clients toolbar: search, Filter, and New client last. Filter opens
 * a popover holding both ways to narrow the list: the Everyone / Leads /
 * Booked scope (one pick, each with its count) and the heat chips. The
 * button counts what is on (a scope other than Everyone counts as one),
 * and Clear filter resets both. It shares
 * one row with the view tabs (see `clients-page.tsx`), so the page has
 * a single line of chrome above the clients. Wraps on narrow screens.
 *
 * @module app/design-system/v2/pages/dashboard/clients/clients-toolbar
 */

export interface ClientsToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  scope: Scope;
  onScope: (s: Scope) => void;
  heats: Heat[];
  onHeats: (h: Heat[]) => void;
  /** Every client, for the filter's counts. */
  clients: Client[];
  /** New client; the button does nothing without it (the view-only demo). */
  onNew?: (() => void) | undefined;
}

/** The Clients toolbar. See {@link ClientsToolbarProps}. */
export function ClientsToolbar({
  query,
  onQuery,
  scope,
  onScope,
  heats,
  onHeats,
  clients,
  onNew,
}: ClientsToolbarProps) {
  const counts = Object.fromEntries(
    SCOPES.map((s) => [s, String(clients.filter((c) => inScope(c, s)).length)]),
  ) as Record<Scope, string>;
  const active = heats.length + (scope === 'Everyone' ? 0 : 1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-52">
        <Input
          type="search"
          aria-label="Search clients"
          placeholder="Search clients"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          leading={<Search strokeWidth={1.5} className="size-4" />}
        />
      </div>
      <div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary">
              <ListFilter aria-hidden="true" strokeWidth={1.5} className="size-4" />
              Filter
              {active > 0 ? <span className="tabular-nums text-zebra-400">{active}</span> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            size="card"
            align="start"
            aria-label="Filter clients"
            className="space-y-4"
          >
            <ChipGroup
              label="Show"
              options={SCOPES}
              hints={counts}
              value={[scope]}
              onChange={([s]) => onScope((s ?? 'Everyone') as Scope)}
            />
            <ChipGroup
              multiple
              label="Heat"
              description="Show only clients Zebri reads as"
              options={HEATS}
              value={heats}
              onChange={(h) => onHeats(h as Heat[])}
            />
            <Button
              variant="plain"
              disabled={active === 0}
              onClick={() => {
                onScope('Everyone');
                onHeats([]);
              }}
            >
              Clear filter
            </Button>
          </PopoverContent>
        </Popover>
      </div>
      <div>
        {/* `data-tour` is where the first-run guide points. */}
        <Button onClick={onNew} data-tour="new-client">
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
          New client
        </Button>
      </div>
    </div>
  );
}
