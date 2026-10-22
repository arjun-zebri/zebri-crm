'use client';

import { useState } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { AvatarStack } from '@/components/ui-v2/avatar-stack';
import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { CodeBlock } from '@/components/ui-v2/code-block';
import { Collapse } from '@/components/ui-v2/collapse';
import { DocumentPage } from '@/components/ui-v2/document-page';
import { FillIcon, TrashIcon } from '@/components/ui-v2/icons';
import { Kbd } from '@/components/ui-v2/kbd';
import { Tooltip } from '@/components/ui-v2/tooltip';

import { ComponentsDisplayMoreV2 } from './components-display-more';
import { Demo, DemoRow, Group, Spec } from './showroom-v2';

/**
 * v2 display pieces: badges in both sizes, avatars, key hints, tooltips, code
 * blocks, the collapse and the A4 document page. Client-side for the collapse toggle.
 *
 * @module app/design-system/v2/components-display
 */
export function ComponentsDisplayV2() {
  const [open, setOpen] = useState(true);
  return (
    <Group id="display" title="Display">
      <Spec
        name="Badge"
        file="components/ui-v2/badge.tsx"
        description="A status, never a button. Small (24px) sits beside a name; control (36px, the panel's corners) takes a button's place when that button's job is done, so the row keeps its height. Neutral, brand green (also called grass), or warning and danger for a status that needs attention. `dot` leads with a 6px status dot in the badge's tone, so a page never hand-draws one."
      >
        <DemoRow>
          <Demo label="Small">
            <span className="flex gap-2">
              <Badge>Max</Badge>
              <Badge tone="brand">Popular</Badge>
              <Badge tone="warning">Clash</Badge>
              <Badge tone="danger">Hot</Badge>
            </span>
          </Demo>
          <Demo label="Control">
            <span className="flex gap-2">
              <Badge size="control">Coming soon</Badge>
              <Badge size="control" tone="brand">Connected</Badge>
            </span>
          </Demo>
          <Demo label="With a dot">
            <span className="flex gap-2">
              <Badge dot>Draft</Badge>
              <Badge dot tone="grass">Booked</Badge>
              <Badge dot tone="warning">Waiting</Badge>
              <Badge dot tone="danger">Overdue</Badge>
            </span>
          </Demo>
        </DemoRow>
      </Spec>
      <Spec name="Avatar" file="components/ui-v2/avatar.tsx" description="Initials in a 32px circle, or a photo (src) over them. Ink for the signed-in MC, muted for everyone else, soft for a couple or a long list, shade for the partner tucked behind in a pair, grass for someone new, such as a fresh enquiry.">
        <DemoRow>
          <Demo label="Ink"><Avatar name="Arjun Punekar" /></Demo>
          <Demo label="Muted"><Avatar name="Hannah Lee" tone="muted" /></Demo>
          <Demo label="Soft"><Avatar name="Amelia" tone="soft" /></Demo>
          <Demo label="Shade"><Avatar name="Jack" tone="shade" /></Demo>
          <Demo label="Grass"><Avatar name="Isla Rhys" tone="grass" /></Demo>
          <Demo label="Photo"><Avatar name="Arjun Punekar" src="/headshot.jpeg" /></Demo>
        </DemoRow>
      </Spec>
      <Spec name="Avatar stack" file="components/ui-v2/avatar-stack.tsx" description="A few faces overlapping, ringed in the page colour, with a +N bubble for the rest: who is already here (the website hero's founding list). Decorative; the text beside it says who, or pass label.">
        <DemoRow>
          <Demo label="Faces and a count">
            <AvatarStack people={[{ name: 'Arjun Punekar', src: '/headshot.jpeg' }, { name: 'Jess Taylor' }, { name: 'Sam Lee' }, { name: 'Priya Shah' }, { name: 'Tom Ward' }]} more={23} />
          </Demo>
        </DemoRow>
      </Spec>
      <Spec name="Key hint" file="components/ui-v2/kbd.tsx" description="A key inside a sentence of help text.">
        <p className="flex items-center gap-1 type-body text-zebra-500">
          Press <Kbd>⌘</Kbd>
          <Kbd>⏎</Kbd> to send
        </p>
      </Spec>
      <Spec name="Tooltip" file="components/ui-v2/tooltip.tsx" description="Names an icon-only control on hover (after a beat) or keyboard focus, never on a click, and never with a native title. The words repeat the control's aria-label, so it is hidden from screen readers. A square Button draws its own from its aria-label (tooltip='…' for other words, tooltip={false} for none); wrap anything else in Tooltip. Never for a button that already has words.">
        <span className="flex gap-1 pb-8">
          <Button variant="ghost" square aria-label="Background">
            <FillIcon aria-hidden="true" className="size-4" />
          </Button>
          <Button variant="ghost" square aria-label="Delete" tooltip="Delete for good">
            <TrashIcon aria-hidden="true" className="size-4" />
          </Button>
          <Tooltip label="Swatch">
            <span tabIndex={0} className="block size-9 rounded-panel bg-grass-700 focus-mark" />
          </Tooltip>
        </span>
      </Spec>
      <Spec
        name="Code block"
        file="components/ui-v2/code-block.tsx"
        description="A snippet to paste somewhere else (a website embed, an API endpoint) in mono on the soft grey fill, with Copy beside it. Long lines scroll sideways, so it pastes exactly as shown."
      >
        <div className="max-w-xl space-y-3">
          <CodeBlock code={'<div data-zebri-form="frm_8f3k2q9xw4"></div>\n<script src="https://zebri.app/embed.js" async></script>'} aria-label="Embed code" />
          <CodeBlock code="https://zebri.app/f/frm_8f3k2q9xw4" label="Copy link" aria-label="Form link" />
        </div>
      </Spec>
      <Spec name="Collapse" file="components/ui-v2/collapse.tsx" description="Eases content open and shut (300ms, height and fade) instead of popping it in.">
        <Button variant="secondary" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'} the timings
        </Button>
        <Collapse open={open}>
          <p className="max-w-xl type-body text-zebra-700">
            Guests arrive 3:00 pm. Ceremony 3:30 pm. Canapés on the lawn from 4:15 pm, then the room opens at 6:00 pm.
          </p>
        </Collapse>
      </Spec>
      <Spec
        name="Document page"
        file="components/ui-v2/document-page.tsx"
        description="A sheet of A4 laid out at real size (794 by 1123px) and scaled down to fit, so an invoice or contract keeps its printed proportions. Lay the content out for the full page, about 64px margins. Used for the couple's copy in the Payments document modal."
      >
        <div className="max-w-sm rounded-panel bg-zebra-50 p-6">
          <DocumentPage aria-label="Sample invoice">
            <div className="space-y-6 p-16">
              <div className="flex justify-between">
                <p className="type-heading">Arjun Punekar MC</p>
                <p className="type-title">Tax invoice</p>
              </div>
              <p className="type-body text-zebra-500">Deposit, Classic MC package · $900.00</p>
            </div>
          </DocumentPage>
        </div>
      </Spec>
      <ComponentsDisplayMoreV2 />
    </Group>
  );
}
