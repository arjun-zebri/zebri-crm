'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { EmailIcon, MoreIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { listById, type Campaign } from '../campaigns-data';
import { RecordLead } from '../record-lead';

import { whenOf } from './campaign-row';

/**
 * The campaign modal's header, from the dialog parts: the email glyph
 * and "Campaign" with Close; then the campaign's name as the big content,
 * over its list and when it went or goes, with the actions on the header row before Close. A sent campaign offers Copy web link (for sharing it on
 * socials); a draft or scheduled one offers Edit, and a scheduled one
 * adds More with Unschedule.
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
    <>
      <DialogHeader
        id="campaign-kind"
        icon={EmailIcon}
        title="Campaign"
        onClose={onClose}
        actions={
          <>
            {c.group === 'scheduled' ? (
              <Popover open={menu} onOpenChange={setMenu}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" square aria-label="More">
                    <MoreIcon aria-hidden="true" className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent size="menu" align="end" role="menu" aria-label="More">
                  <MenuOption onSelect={() => setMenu(false)}>Unschedule</MenuOption>
                </PopoverContent>
              </Popover>
            ) : null}
            {c.group === 'sent' ? (
              <CopyButton value={`https://arjunmc.com.au/email/${c.id}`} label="Copy web link" />
            ) : (
              <Button variant="secondary" onClick={onEdit}>
                Edit
              </Button>
            )}
          </>
        }
      />
      <RecordLead id="campaign-title" name={c.name} roomy>
        <p className="type-body text-zebra-500">
          {listById(c.list).name} · {whenOf(c)}
        </p>
      </RecordLead>
    </>
  );
}
