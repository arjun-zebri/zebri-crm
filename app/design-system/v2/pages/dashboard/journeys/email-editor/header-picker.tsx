'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Segmented } from '@/components/ui-v2/segmented';

import type { EmailHeader } from '../../email/email-data';
import { Masthead } from '../../email/render/email-body';
import { UNNAMED } from '../../first-run/use-new-account';

import { useImageDrop } from './email-media';
import { CardRow } from './email-nodes';

/**
 * The top of a journey email, as the client sees it (the business name in
 * the brand's heading face, or the logo), and the way to change it:
 * clicking it opens a card to show the name, the logo or nothing, retype
 * the name for this email, or upload a logo. With nothing shown, a quiet
 * "Add a header" line keeps the way back.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/header-picker
 */

export interface HeaderPickerProps {
  header: EmailHeader;
  business: string;
  /** The brand's logo, if they have one. */
  logoUrl: string | null;
  onChange: (next: EmailHeader) => void;
}

const SHOWS = ['name', 'logo', 'none'] as const;

/** The picker. See {@link HeaderPickerProps}. */
export function HeaderPicker({ header, business, logoUrl, onChange }: HeaderPickerProps) {
  const [open, setOpen] = useState(false);
  const drop = useImageDrop((logo) => onChange({ ...header, show: 'logo', logo }));
  const logo = header.logo ?? logoUrl;
  // A new account's "You" is not a name to retype.
  const named = business === UNNAMED ? '' : business;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Change the header" className={`-mx-3 mb-6 block w-[calc(100%+1.5rem)] rounded-check px-3 py-2 text-center transition-colors duration-150 hover:bg-hover focus-mark motion-reduce:transition-none ${open ? 'bg-pressed' : ''}`}>
          {header.show === 'none' ? <span className="type-body text-zebra-400">Add a header</span> : <Masthead header={header} business={business} logoUrl={logoUrl} />}
        </button>
      </PopoverTrigger>
      <PopoverContent size="card" align="center" aria-label="Header">
        <div className="flex min-h-9 items-center gap-3 type-body">
          <span className="w-16 shrink-0 text-zebra-500">Shows</span>
          <Segmented label="Shows" options={SHOWS} labels={{ name: 'Name', logo: 'Logo', none: 'Nothing' }} value={header.show} onChange={(show) => onChange({ ...header, show })} />
        </div>
        {header.show === 'name' ? <CardRow label="Name" value={header.text ?? named} placeholder={named || 'Your business name'} onChange={(text) => onChange({ ...header, text })} /> : null}
        {header.show === 'logo' ? (
          <div className="flex min-h-9 items-center gap-3 type-body">
            <span className="w-16 shrink-0 text-zebra-500">Logo</span>
            <Button variant="text" onClick={drop.browse}>
              {logo ? 'Change' : 'Upload'}
            </Button>
            {drop.picker}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
