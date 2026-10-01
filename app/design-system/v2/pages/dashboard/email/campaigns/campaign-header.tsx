'use client';

import { MoreHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { listById, type Campaign } from '../campaigns-data';

import { whenOf } from './campaign-row';

/**
 * The campaign modal's header, one row, as on the proposal modal: the
 * campaign's name over its list and when it went or goes, then the
 * actions. A sent campaign offers Copy web link (for sharing it on
 * socials); a draft or scheduled one offers Edit, and a scheduled one
 * adds More with Unschedule. Close sits past a hairline. On phones the
 * actions wrap under the title.
 *
 * @module app/design-system/v2/pages/dashboard/email/campaigns/campaign-header
 */

export interface CampaignHeaderProps {
  campaign: Campaign;
  onEdit: () => void;
  onClose: () => void;
}

/** The header. See {@link CampaignHeaderProps}. */
export function CampaignHeader({ campaign: c, onEdit, onClose }: CampaignHeaderProps) {
  const [menu, setMenu] = useState(false);
  return (
    <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id="campaign-title" className="type-title text-zebra-950">
          {c.name}
        </h2>
        <p className="type-body text-zebra-500">
          {listById(c.list).name} · {whenOf(c)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 max-sm:order-last max-sm:w-full">
        {c.group === 'sent' ? (
          <CopyButton value={`https://arjunmc.com.au/email/${c.id}`} label="Copy web link" />
        ) : (
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1 sm:border-l sm:border-zebra-950/5 sm:pl-4">
        {c.group === 'scheduled' ? (
          <Popover open={menu} onOpenChange={setMenu}>
            <PopoverTrigger asChild>
              <Button variant="ghost" square aria-label="More">
                <MoreHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent size="menu" align="end" role="menu" aria-label="More">
              <MenuOption onSelect={() => setMenu(false)}>Unschedule</MenuOption>
            </PopoverContent>
          </Popover>
        ) : null}
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </div>
    </header>
  );
}
