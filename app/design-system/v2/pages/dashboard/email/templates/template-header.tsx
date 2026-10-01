'use client';

import { MoreHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { shortDate } from '../../payments/dates';
import { FOLDERS, SOURCE_NAMES, type EmailTemplate } from '../email-data';
import type { EmailState } from '../use-email-state';

/**
 * The template dialog's header, one row, as on the proposal modal: the
 * name over its folder, how it was made and when it was last edited;
 * Edit (secondary: the page is view only, and nothing here is urgent
 * enough to be primary); then More and Close past a hairline. More holds
 * Duplicate, Move to folder, and Archive, or Restore for an archived
 * one. Templates archive rather than delete, so the emails already sent
 * from one keep their copy on each client.
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/template-header
 */

export interface TemplateHeaderProps {
  template: EmailTemplate;
  state: EmailState;
  onEdit: () => void;
  onClose: () => void;
}

/** The header. See {@link TemplateHeaderProps}. */
export function TemplateHeader({ template: t, state, onEdit, onClose }: TemplateHeaderProps) {
  const [menu, setMenu] = useState(false);
  const folder = FOLDERS.find((f) => f.id === t.folder)?.name;
  const items = [
    { label: 'Duplicate', run: () => undefined },
    { label: 'Move to folder', run: () => undefined },
    t.archivedOn ? { label: 'Restore', run: () => state.restore(t.id) } : { label: 'Archive', run: () => state.archive(t.id) },
  ];
  return (
    <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id="template-title" className="type-title text-zebra-950">
          {t.name}
        </h2>
        <p className="type-body text-zebra-500">
          {folder} · {SOURCE_NAMES[t.source]} · edited {shortDate(t.editedOn)} {t.editedOn.slice(0, 4)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 max-sm:order-last max-sm:w-full">
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <div className="flex items-center gap-1 sm:border-l sm:border-zebra-950/5 sm:pl-4">
        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger asChild>
            <Button variant="ghost" square aria-label="More">
              <MoreHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent size="menu" align="end" role="menu" aria-label="More">
            {items.map((item) => (
              <MenuOption
                key={item.label}
                onSelect={() => {
                  item.run();
                  setMenu(false);
                }}
              >
                {item.label}
              </MenuOption>
            ))}
          </PopoverContent>
        </Popover>
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </div>
    </header>
  );
}
