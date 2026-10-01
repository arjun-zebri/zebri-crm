'use client';

import { useState } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { Collapse } from '@/components/ui-v2/collapse';
import { DocumentPage } from '@/components/ui-v2/document-page';
import { Kbd } from '@/components/ui-v2/kbd';

import { Demo, DemoRow, Group, Spec } from './showroom-v2';

/**
 * v2 display pieces: badges in both sizes, avatars, key hints, the
 * collapse and the A4 document page. Client-side for the collapse toggle.
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
        description="A status, never a button. Small (24px) sits beside a name; control (32px) takes a button's place when that button's job is done, so the row keeps its height. Neutral, brand green, or warning and danger for a status that needs attention."
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
        </DemoRow>
      </Spec>
      <Spec name="Avatar" file="components/ui-v2/avatar.tsx" description="Initials in a 32px circle. Ink for the signed-in MC, muted for everyone else, soft for a couple or a long list, shade for the partner tucked behind in a pair.">
        <DemoRow>
          <Demo label="Ink"><Avatar name="Arjun Punekar" /></Demo>
          <Demo label="Muted"><Avatar name="Hannah Lee" tone="muted" /></Demo>
          <Demo label="Soft"><Avatar name="Amelia" tone="soft" /></Demo>
          <Demo label="Shade"><Avatar name="Jack" tone="shade" /></Demo>
        </DemoRow>
      </Spec>
      <Spec name="Key hint" file="components/ui-v2/kbd.tsx" description="A key inside a sentence of help text.">
        <p className="flex items-center gap-1 type-body text-zebra-500">
          Press <Kbd>⌘</Kbd>
          <Kbd>⏎</Kbd> to send
        </p>
      </Spec>
      <Spec name="Collapse" file="components/ui-v2/collapse.tsx" description="Eases content open and shut (300ms, height and fade) instead of popping it in.">
        <Button variant="secondary" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'} the timings
        </Button>
        <Collapse open={open}>
          <p className="max-w-xl type-body text-zebra-700">
            Guests arrive 3:00pm. Ceremony 3:30pm. Canapés on the lawn from 4:15pm, then the room opens at 6:00pm.
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
    </Group>
  );
}
