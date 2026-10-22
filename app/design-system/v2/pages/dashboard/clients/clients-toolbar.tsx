'use client';

import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { FilterIcon, PlusIcon, SearchIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { BarIcons } from '../bar-icons';

import { HEATS, SCOPES, inScope, type Client, type Heat, type Scope } from './clients-data';

/**
 * The Clients toolbar: search, then Filter and New client as bare icons
 * (`BarIcons`), New client last. Filter opens
 * a popover holding both ways to narrow the list: the Everyone / Leads /
 * Booked scope (one pick, each with its count) and the heat chips. The
 * icon wears a dot while anything is on, its tooltip the count (a scope other than Everyone counts as one),
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
          raised
          aria-label="Search clients"
          placeholder="Search clients"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          leading={<SearchIcon aria-hidden="true" className="size-4" />}
        />
      </div>
      <BarIcons>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              square
              aria-label={active > 0 ? `Filter, ${active} on` : 'Filter'}
              tooltip={active > 0 ? `Filter · ${active} on` : 'Filter'}
            >
              <FilterIcon aria-hidden="true" className="size-4" />
              {active > 0 ? (
                // As the bell's new dot: ringed in white so it reads as a mark on the corner.
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 size-2 rounded-pill bg-grass-500 ring-2 ring-field"
                />
              ) : null}
            </Button>
          </PopoverTrigger>
          {/* 11px: a card's 8px gap, plus the 3px the icon sits inside its glass pill (BarIcons). */}
          <PopoverContent
            size="card"
            align="start"
            sideOffset={11}
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
        {/* `data-tour` is where the first-run guide points. */}
        <Button
          variant="ghost"
          square
          aria-label="New client"
          tooltip={false}
          onClick={onNew}
          data-tour="new-client"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </Button>
      </BarIcons>
    </div>
  );
}
