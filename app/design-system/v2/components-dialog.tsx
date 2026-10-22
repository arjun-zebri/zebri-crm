'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { ChevronDownIcon, GuestsIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Sheet } from '@/components/ui-v2/sheet';
import { TextLink } from '@/components/ui-v2/text-link';

import { ComponentsDialogPartsV2 } from './components-dialog-parts';
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
  const [open, setOpen] = useState<'sm' | 'form' | 'short' | 'split' | 'split-tall' | 'lg' | 'xl' | 'screen' | null>(null);
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
        description="A native modal dialog. Small is a card that grows with its content; form is the same at 40rem, for a short task over another dialog (a reminder over an invoice, which stacks in front); medium, split, large and extra large are fixed heights that never change while open (short is 38rem by 36rem, smaller than medium, for a few settings; split is 56rem by 37rem, a short list beside its detail such as the Payments AI insights; split-tall is 41rem tall, the same with a footer under both panes, as Settings has for its Save) (Blocks is large, a client's profile extra large) that fill the screen on phones. `expanded` grows a workspace to nearly the whole window, easing its width and height, for a moment that needs the room (a video call on a client's profile). `backdrop='light'` washes the page pale instead of grey, for a celebration (the booking), so the confetti behind the card stays bright. `closeOnBackdrop={false}` keeps a click on the dimmed page from closing it, for the document editor, where a stray click must never end the work. `modal={false}` draws it as a layer on the page instead of in the browser's top layer, so things that portal to the page body (production's proposal editor: its text bar and popovers) still show above it and can be clicked; Escape still closes it. Each is built from the dialog parts below: an icon circle and a quiet title, Close at the top right, no bars, the primary last; the small one is a confirmation, so it has a plain Cancel."
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setOpen('sm')}>
            Open small dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('form')}>
            Open form dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('short')}>
            Open short dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('split')}>
            Open split dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('split-tall')}>
            Open tall split dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('lg')}>
            Open large dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('xl')}>
            Open extra large dialog
          </Button>
          <Button variant="secondary" onClick={() => setOpen('screen')}>
            Open full screen editor
          </Button>
          {(['sm', 'form', 'short', 'split', 'split-tall', 'lg', 'xl', 'screen'] as const).map((size) => (
            <Dialog
              key={size}
              size={size}
              expanded={size === 'xl' && expanded}
              open={open === size}
              onClose={close}
              aria-labelledby={`dlg-${size}`}
            >
              <DialogHeader
                id={`dlg-${size}`}
                icon={GuestsIcon}
                title={size === 'sm' ? 'Remove Proposals?' : size === 'form' ? 'Reminder' : size === 'short' ? 'Balance' : size === 'split' ? 'AI insights' : size === 'split-tall' ? 'Settings' : size === 'lg' ? 'Blocks' : size === 'screen' ? 'Proposal for Amelia & Jack' : 'Amelia & Jack'}
              />
              <DialogBody className="space-y-4">
                <p className="type-body text-zebra-500">
                  {size === 'sm'
                    ? 'It leaves your sidebar. Your proposals are kept, and adding it back brings them all back.'
                    : size === 'screen'
                      ? 'The whole window, with no dimmed edge: an editor a stray click must never close.'
                      : 'A workspace of fixed height, so filtering what is inside never makes it jump.'}
                </p>
                {size === 'xl' ? (
                  <Button variant="secondary" onClick={() => setExpanded((e) => !e)}>
                    {expanded ? 'Shrink back' : 'Expand'}
                  </Button>
                ) : null}
              </DialogBody>
              <DialogFooter>
                {size === 'sm' ? (
                  <Button variant="plain" onClick={close}>
                    Cancel
                  </Button>
                ) : null}
                <Button variant={size === 'sm' ? 'danger' : 'primary'} onClick={close}>
                  {size === 'sm' ? 'Remove' : 'Done'}
                </Button>
              </DialogFooter>
            </Dialog>
          ))}
        </div>
      </Spec>
      <Spec
        name="Sheet"
        file="components/ui-v2/sheet.tsx"
        description="Slides in from the right of the surface it sits in, over the same scrim as a dialog, for a focused job that should not replace the page behind it (reviewing a drafted email on a client's profile). Escape closes the sheet, not the dialog around it."
      >
        <div className="relative h-72 overflow-hidden rounded-panel bg-zebra-50 p-5">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Review draft
          </Button>
          <Sheet open={sheet} onClose={() => setSheet(false)} aria-labelledby="demo-sheet">
            <DialogHeader id="demo-sheet" title="Email to Amelia" onClose={() => setSheet(false)} />
            <DialogBody>
              <p className="type-body text-zebra-600">Quick one: could you send your final guest numbers by Friday?</p>
            </DialogBody>
          </Sheet>
        </div>
      </Spec>
      <Spec
        name="Popover"
        file="components/ui-v2/popover.tsx"
        description="Floats beside what opened it, on the same surface as the Dropdown menu. Menu for a short list of picks (a `MenuOption` with a `description` grows to two lines, the name over what it does; with `multiple`, several can be on at once, as in a Show menu), card for facts and one action, panel for a scrolling 384px panel with its own layout."
      >
        <DemoRow>
          <Demo label="Menu">
            <Popover open={menu} onOpenChange={setMenu}>
              <PopoverTrigger asChild>
                <Button variant="ghost">
                  <GuestsIcon aria-hidden="true" className="size-4 text-zebra-500" />
                  {scope}
                  <ChevronDownIcon
                    aria-hidden="true"
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
      <ComponentsDialogPartsV2 />
    </Group>
  );
}
