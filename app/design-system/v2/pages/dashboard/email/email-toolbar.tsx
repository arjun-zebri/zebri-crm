'use client';

import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Input } from '@/components/ui-v2/input';

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
            aria-label={`Search ${many}`}
            placeholder={`Search ${many}`}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            leading={<Search strokeWidth={1.5} className="size-4" />}
          />
        </div>
      ) : null}
      {tab === 'templates' ? (
        <Button variant="secondary" onClick={onSignatures}>
          Signatures
        </Button>
      ) : null}
      <div>
        <Button onClick={onNew}>
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
          New {one}
        </Button>
      </div>
    </div>
  );
}
