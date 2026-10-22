'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { ArchiveIcon, EnquiriesIcon, MoreIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { agoText, type Enquiry } from '../demo-activity';

import { sourceLabel } from './enquiries-data';

/**
 * The enquiry modal's top, in the house dialog anatomy: `DialogHeader`
 * (the enquiries glyph in its circle, "Enquiry" quiet beside it, Close
 * at the top right), then the couple as the dialog's big content, as
 * New client's names are, with when and where it came in under them.
 * More and Archive sit on the header row before Close. More holds Open
 * client, since every enquiry is already a client.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/enquiry-header
 */

export interface EnquiryHeaderProps {
  enquiry: Enquiry;
  onArchive: () => void;
  onClose: () => void;
}

/** The header. See {@link EnquiryHeaderProps}. */
export function EnquiryHeader({ enquiry: e, onArchive, onClose }: EnquiryHeaderProps) {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <DialogHeader
        id="enquiry-title"
        icon={EnquiriesIcon}
        title="Enquiry"
        onClose={onClose}
        actions={
          <>
            <Popover open={menu} onOpenChange={setMenu}>
              <PopoverTrigger asChild>
                <Button variant="ghost" square aria-label="More">
                  <MoreIcon aria-hidden="true" className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent size="menu" align="end" role="menu" aria-label="More">
                {/* The preview has no route to a client from here yet. */}
                <MenuOption onSelect={() => setMenu(false)}>Open client</MenuOption>
              </PopoverContent>
            </Popover>
            <Button variant="secondary" onClick={onArchive} icon={<ArchiveIcon aria-hidden="true" className="size-4" />}>
              Archive
            </Button>
          </>
        }
      />
      <div className="shrink-0 space-y-1 px-6 pt-6 sm:px-10">
        <p className="type-title text-zebra-950 md:type-display">{e.client}</p>
        <p className="type-body text-zebra-500">
          Enquired {agoText(e.ago)} · {sourceLabel(e)}
        </p>
      </div>
    </>
  );
}
