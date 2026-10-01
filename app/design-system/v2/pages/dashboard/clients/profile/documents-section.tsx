'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { DocDetail } from './doc-detail';
import { DocRow } from './doc-row';
import type { Doc, Profile } from './profile-data';
import { ProfileGroup } from './section-frame';
import { SelectRow } from './select-row';
import { SplitSection } from './split-section';

/**
 * Every document for the client in one list: what is still moving first,
 * then what is finished, then what other people shared with the MC. The
 * selected one shows in the panel on the right, previewed, with what it
 * needs and the button that does it. Replaces seven of the current app's
 * tabs.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/documents-section
 */

const GROUPS: { title: string; group: Doc['group'] }[] = [
  { title: 'In progress', group: 'progress' },
  { title: 'Complete', group: 'complete' },
  { title: 'Shared with you', group: 'shared' },
];

// What New document can make; an upload has its own button.
const KINDS = [
  'Proposal',
  'Contract',
  'Invoice',
  'Questionnaire',
  'Run sheet',
  'Music',
  'Speeches',
  'Script',
];

/** The Documents section. */
export function DocumentsSection({ profile }: { profile: Profile }) {
  const { docs } = profile;
  const [picked, setPicked] = useState(docs[0]?.id);
  const current = docs.find((d) => d.id === picked) ?? docs[0];
  return (
    <SplitSection
      asideLabel="Document details"
      wideOnly
      main={
        <div className="max-w-3xl space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto type-body text-zebra-500">
              {docs.length} {docs.length === 1 ? 'document' : 'documents'}
            </p>
            <Button variant="secondary">Upload</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button>New document</Button>
              </PopoverTrigger>
              <PopoverContent size="menu" align="end" role="menu" aria-label="New document">
                {KINDS.map((k) => (
                  <MenuOption key={k} onSelect={() => undefined}>
                    {k}
                  </MenuOption>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          {GROUPS.map(({ title, group }) => {
            const list = docs.filter((d) => d.group === group);
            return list.length ? (
              <ProfileGroup key={group} title={title}>
                <ul className="-mx-3 space-y-1">
                  {list.map((d) => (
                    <SelectRow
                      key={d.id}
                      selected={d === current}
                      onSelect={() => setPicked(d.id)}
                      detail={<DocDetail doc={d} />}
                    >
                      <DocRow doc={d} />
                    </SelectRow>
                  ))}
                </ul>
              </ProfileGroup>
            ) : null;
          })}
        </div>
      }
      aside={current ? <DocDetail doc={current} /> : null}
    />
  );
}
