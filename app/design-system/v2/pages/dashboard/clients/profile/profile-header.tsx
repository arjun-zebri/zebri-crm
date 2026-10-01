'use client';

import { MoreHorizontal, X } from 'lucide-react';
import { Fragment } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import type { Stage } from '../clients-data';

import type { EventInfo } from './profile-data';

/**
 * The main area's header, above every section: the client's name, their
 * stage as a pill, and one line saying what the event is, when and
 * where. More and Close sit top right; a hairline sets the header off
 * from the section under it. More holds what the current app's profile
 * header held, grouped by space.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/profile-header
 */

const MORE: string[][] = [
  ['Change stage', 'Change workflow', 'Stop Zebri for this client'],
  ['Copy portal link', 'Copy supplier link'],
  ['Start timer', 'Download run sheet', 'Download speeches'],
  ['Rotate portal links', 'Delete client'],
];

/** The padding every part of the main area shares, so their edges line up. */
export const GUTTER = 'px-5 md:px-10';

export interface ProfileHeaderProps {
  /** The client's name; also the dialog's accessible name. */
  name: string;
  stage: Stage;
  event: EventInfo;
  onClose: () => void;
}

/** The header. See {@link ProfileHeaderProps}. */
export function ProfileHeader({ name, stage, event, onClose }: ProfileHeaderProps) {
  const when = [event.date, event.time].filter(Boolean).join(', ');
  return (
    <header
      className={`flex items-start gap-2 border-b border-zebra-200 pb-6 pt-6 md:pt-8 ${GUTTER}`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="profile-title" className="type-title text-zebra-950">
            {name}
          </h2>
          <span className="inline-flex h-7 items-center gap-2 rounded-pill border border-zebra-200 px-3 type-body text-zebra-950">
            <span aria-hidden="true" className="size-1.5 rounded-pill bg-grass-500" />
            {stage}
          </span>
        </div>
        <p className="type-body text-zebra-500">
          {[event.type, when, event.venue].filter(Boolean).join(' · ')}
        </p>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" square aria-label="More">
            <MoreHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent size="menu" align="end" role="menu" aria-label="More">
          {MORE.map((group, i) => (
            <Fragment key={group[0]}>
              {/* Space, not a rule, between groups. */}
              {i ? <div aria-hidden="true" className="h-2" /> : null}
              {group.map((item) => (
                <MenuOption key={item} onSelect={() => undefined}>
                  <span className={item.startsWith('Delete') ? 'text-danger' : undefined}>
                    {item}
                  </span>
                </MenuOption>
              ))}
            </Fragment>
          ))}
        </PopoverContent>
      </Popover>
      <Button variant="ghost" square aria-label="Close" onClick={onClose}>
        <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
      </Button>
    </header>
  );
}
