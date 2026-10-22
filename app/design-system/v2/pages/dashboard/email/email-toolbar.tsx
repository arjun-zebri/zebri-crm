'use client';

import { Button } from '@/components/ui-v2/button';
import { EditIcon, PlusIcon, SearchIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { BarIcons } from '../bar-icons';

import { MailboxButton } from './mailbox-button';

/**
 * The Email toolbar, on the same row as the tabs, as on Proposals and
 * Payments. The sending mailbox shows on every tab (everything here
 * sends through it). Campaigns and Templates add search; Templates adds
 * Signatures; each tab but Overview ends in its one primary, New.
 * Wraps on narrow screens.
 *
 * @module app/design-system/v2/pages/dashboard/email/email-toolbar
 */

export type Tab = 'overview' | 'campaigns' | 'templates' | 'lists';

const NOUN: Record<Exclude<Tab, 'overview'>, [one: string, many: string]> = {
  campaigns: ['campaign', 'campaigns'],
  templates: ['template', 'templates'],
  lists: ['list', 'lists'],
};

export interface EmailToolbarProps {
  tab: Tab;
  query: string;
  onQuery: (q: string) => void;
  onNew: () => void;
  onSignatures: () => void;
}

/** The toolbar. See {@link EmailToolbarProps}. */
export function EmailToolbar({ tab, query, onQuery, onNew, onSignatures }: EmailToolbarProps) {
  if (tab === 'overview') return <MailboxButton />;
  const [one, many] = NOUN[tab];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MailboxButton />
      {tab !== 'lists' ? (
        <div className="w-full sm:w-52">
          <Input
            type="search"
            raised
            aria-label={`Search ${many}`}
            placeholder={`Search ${many}`}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            leading={<SearchIcon className="size-4" />}
          />
        </div>
      ) : null}
      <BarIcons>
        {tab === 'templates' ? (
          <Button
            variant="ghost"
            square
            aria-label="Signatures"
            tooltip="Signatures"
            onClick={onSignatures}
          >
            <EditIcon aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
        <Button variant="ghost" square aria-label={`New ${one}`} tooltip={false} onClick={onNew}>
          <PlusIcon aria-hidden="true" className="size-4" />
        </Button>
      </BarIcons>
    </div>
  );
}
