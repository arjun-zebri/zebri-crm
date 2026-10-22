'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DocumentsIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import type { EmailTemplate } from '../../documents/email-templates';

/**
 * Use a template, in a journey email's builder: the MC's email templates
 * from Documents, one of which replaces what is written with its subject
 * and words. The same menu as Documents' New (a `Popover` of
 * `MenuOption`s). Nothing to show when the MC has no templates.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/template-menu
 */

/** The menu. */
export function TemplateMenu({ templates, onPick }: { templates: EmailTemplate[]; onPick: (t: EmailTemplate) => void }) {
  const [open, setOpen] = useState(false);
  if (!templates.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" icon={<DocumentsIcon aria-hidden="true" className="size-4" />}>
          Use a template
        </Button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="start" role="menu" aria-label="Use a template">
        {templates.map((t) => (
          <MenuOption key={t.id} onSelect={() => (setOpen(false), onPick(t))}>
            {t.name}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
