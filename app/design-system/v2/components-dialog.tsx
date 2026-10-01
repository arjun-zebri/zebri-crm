'use client';

import { ChevronDown, Users, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Sheet } from '@/components/ui-v2/sheet';
import { TextLink } from '@/components/ui-v2/text-link';

import { Demo, DemoRow, Group, Spec } from './showroom-v2';

const SCOPES = ['All clients', 'Sophie & James', 'Sarah & Tom'];

/**
 * v2 overlays: the dialog in its sizes behind a trigger each, and the
 * popover's menu and card sizes. The panel size is the dashboard's
 * calendar, enquiries and notifications.
 *
 * @module app/design-system/v2/components-dialog
 */
export function ComponentsDialogV2() {
  const [open, setOpen] = useState<'sm' | 'form' | 'split' | 'lg' | 'xl' | null>(null);
  const [scope, setScope] = useState(SCOPES[0] ?? '');
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const close = () => {
    setOpen(null);
    setExpanded(false);
  };
  return (
    <Group id="overlays" title="Overlays">
      <Spec
        name="Dialog"
        file="components/ui-v2/dialog.tsx"
        description="A native modal dialog. Small is a card that grows with its content; form is the same at 40rem, for a short task over another dialog (a reminder over an invoice, which stacks in front); medium, split, large and extra large are fixed heights that never change while open (split is 56rem by 37rem, a short list beside its detail such as the Payments AI insights) (Blocks is large, a client's profile extra large) that fill the screen on phones. `expanded` grows a workspace to nearly the whole window, easing its width and height, for a moment that needs the room (a video call on a client's profile). `backdrop='light'` washes the page pale instead of grey, for a celebration (the booking), so the confetti behind the card stays bright. The title is a subheading."
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setOpen('sm')}>
            Open small dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('form')}>
            Open form dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('split')}>
            Open split dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('lg')}>
            Open large dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('xl')}>
            Open extra large dialog
          </Button>
          {(['sm', 'form', 'split', 'lg', 'xl'] as const).map((size) => (
            <Dialog
              key={size}
              size={size}
              expanded={size === 'xl' && expanded}
              open={open === size}
              onClose={close}
              aria-labelledby={`dlg-${size}`}
            >
              <header className="flex items-start gap-4 px-5 pt-4">
                <h2
                  id={`dlg-${size}`}
                  className="min-w-0 flex-1 pt-1 type-subheading text-zebra-950"
                >
                  {size === 'sm' ? 'Remove Proposals?' : size === 'form' ? 'Reminder' : size === 'split' ? 'AI insights' : size === 'lg' ? 'Blocks' : 'Amelia & Jack'}
                </h2>
                <Button variant="ghost" square aria-label="Close" onClick={close}>
                  <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
                </Button>
              </header>
              <div className="flex-1 space-y-4 px-5 pb-5 pt-2">
                <p className="type-body text-zebra-500">
                  {size === 'sm'
                    ? 'It leaves your sidebar. Your proposals are kept, and adding it back brings them all back.'
                    : 'A workspace of fixed height, so filtering what is inside never makes it jump.'}
                </p>
                {size === 'xl' ? (
                  <Button variant="secondary" onClick={() => setExpanded((e) => !e)}>
                    {expanded ? 'Shrink back' : 'Expand'}
                  </Button>
                ) : null}
                {size === 'sm' ? (
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={close}>
                      Cancel
                    </Button>
                    <Button onClick={close}>Remove</Button>
                  </div>
                ) : null}
              </div>
            </Dialog>
          ))}
        </div>
      </Spec>
      <Spec
        name="Sheet"
        file="components/ui-v2/sheet.tsx"
        description="Slides in from the right of the surface it sits in, over a faint scrim, for a focused job that should not replace the page behind it (reviewing a drafted email on a client's profile). Escape closes the sheet, not the dialog around it."
      >
        <div className="relative h-72 overflow-hidden rounded-panel bg-zebra-50 p-5">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Review draft
          </Button>
          <Sheet open={sheet} onClose={() => setSheet(false)} aria-labelledby="demo-sheet">
            <header className="flex items-center justify-between px-5 pt-4">
              <h2 id="demo-sheet" className="type-subheading text-zebra-950">
                Email to Amelia
              </h2>
              <Button variant="ghost" square aria-label="Close" onClick={() => setSheet(false)}>
                <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </header>
            <p className="px-5 pt-2 type-body text-zebra-600">Quick one: could you send your final guest numbers by Friday?</p>
          </Sheet>
        </div>
      </Spec>
      <Spec
        name="Popover"
        file="components/ui-v2/popover.tsx"
        description="Floats beside what opened it, on the same surface as the Dropdown menu. Menu for a short list of picks, card for facts and one action, panel for a scrolling 384px panel with its own layout."
      >
        <DemoRow>
          <Demo label="Menu">
            <Popover open={menu} onOpenChange={setMenu}>
              <PopoverTrigger asChild>
                <Button variant="ghost">
                  <Users aria-hidden="true" strokeWidth={1.5} className="size-4 text-zebra-500" />
                  {scope}
                  <ChevronDown
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="size-4 text-zebra-500"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent size="menu" align="start" role="menu" aria-label="Scope">
                {SCOPES.map((s) => (
                  <MenuOption
                    key={s}
                    selected={s === scope}
                    onSelect={() => {
                      setScope(s);
                      setMenu(false);
                    }}
                  >
                    {s}
                  </MenuOption>
                ))}
              </PopoverContent>
            </Popover>
          </Demo>
          <Demo label="Card">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary">Sophie &amp; James</Button>
              </PopoverTrigger>
              <PopoverContent
                size="card"
                align="start"
                aria-label="Sophie & James"
                className="space-y-4"
              >
                <div className="space-y-1">
                  <p className="type-label text-zebra-950">Sophie &amp; James · Sat 14 Mar</p>
                  <p className="type-body text-zebra-500">Proposal viewed 3 times, not signed.</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <TextLink href="#overlays">Open client</TextLink>
                  <Button>Send reminder</Button>
                </div>
              </PopoverContent>
            </Popover>
          </Demo>
        </DemoRow>
      </Spec>
    </Group>
  );
}
