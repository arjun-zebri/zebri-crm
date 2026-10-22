'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { TemplatesIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';

import { fillFields } from '../email-data';
import type { EmailState } from '../use-email-state';

import { FolderRail, inFolder, type FolderPick } from './folder-rail';
import { TemplateColumns, TemplateRow } from './template-row';

/**
 * The Templates tab: the library every email starts from. Folders on the
 * left (`FolderRail`), the folder's templates on a glass panel on the
 * right, each with how it has done (`TemplateRow`), most sent first so
 * the ones doing the work lead. Search (in the toolbar) looks through
 * names and subjects inside the current folder. A row opens the
 * template's preview. Archived templates only show under Archived.
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/templates-view
 */

export interface TemplatesViewProps {
  state: EmailState;
  /** The search, trimmed and lower-cased. */
  query: string;
  onOpen: (id: string) => void;
  onClearQuery: () => void;
}

/** The Templates tab. See {@link TemplatesViewProps}. */
export function TemplatesView({ state, query, onOpen, onClearQuery }: TemplatesViewProps) {
  const [folder, setFolder] = useState<FolderPick>('all');
  const rows = state.templates
    .filter((t) => inFolder(t, folder))
    .filter((t) => query === '' || `${t.name} ${fillFields(t.subject)}`.toLowerCase().includes(query))
    .sort((a, b) => b.sent - a.sent);
  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <FolderRail templates={state.templates} value={folder} onChange={setFolder} />
      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            compact
            icon={TemplatesIcon}
            title={query ? 'Nothing matches that search' : folder === 'archived' ? 'Nothing archived' : 'No templates here yet'}
            body={query ? 'Try other words, or look in another folder.' : folder === 'archived' ? 'Archived templates show here, with the emails they sent kept.' : 'Templates you make or move into this folder show here.'}
            action={
              query ? (
                <Button variant="secondary" onClick={onClearQuery}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div>
          <TemplateColumns />
          <Panel className="p-2">
            <ul className="space-y-0.5">
              {rows.map((t) => (
                <TemplateRow key={t.id} template={t} onOpen={() => onOpen(t.id)} />
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
