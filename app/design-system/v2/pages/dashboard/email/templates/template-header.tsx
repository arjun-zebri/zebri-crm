'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { MoreIcon, TemplatesIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { DesignButton } from '../../canvas/docs/design-button';
import { fullDate } from '../../payments/dates';
import { FOLDERS, SOURCE_NAMES, type EmailTemplate } from '../email-data';
import { RecordLead } from '../record-lead';
import type { EmailState } from '../use-email-state';

/**
 * The template dialog's header, from the dialog parts: the templates
 * glyph and "Email template" with Close; then the template's name as the
 * big content, over its folder, how it was made and when it was last
 * edited. Design, More and Edit sit on the header row before Close (Edit secondary: the
 * page is view only, and nothing here is urgent enough to be primary). More holds
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
    t.archivedOn
      ? { label: 'Restore', run: () => state.restore(t.id) }
      : { label: 'Archive', run: () => state.archive(t.id) },
  ];
  return (
    <>
      <DialogHeader
        id="template-kind"
        icon={TemplatesIcon}
        title="Email template"
        onClose={onClose}
        actions={
          <>
            <DesignButton
              kind="email"
              data={{
                subject: t.subject,
                body: t.blocks.flatMap((b) => ('text' in b ? [b.text] : [])).join('\n\n'),
                button: t.blocks.find((b) => b.kind === 'button')?.label ?? 'View online',
              }}
            />
            <Popover open={menu} onOpenChange={setMenu}>
              <PopoverTrigger asChild>
                <Button variant="ghost" square aria-label="More">
                  <MoreIcon aria-hidden="true" className="size-4" />
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
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          </>
        }
      />
      <RecordLead id="template-title" name={t.name} roomy>
        <p className="type-body text-zebra-500">
          {folder} · {SOURCE_NAMES[t.source]} · edited {fullDate(t.editedOn)}
        </p>
      </RecordLead>
    </>
  );
}
