'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader, DoneView } from '@/components/ui-v2/dialog-parts';
import { EmailIcon, TrashIcon, UserIcon, UserPlusIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { Demo, DemoRow, Spec } from './showroom-v2';

/**
 * v2 overlays, continued: the dialog parts (one anatomy for every
 * dialog: a form beside a confirmation) and the dialog layer, the
 * non-modal form of `Dialog`. Rendered inside the Overlays group by
 * `components-dialog.tsx`.
 *
 * @module app/design-system/v2/components-dialog-parts
 */
export function ComponentsDialogPartsV2() {
  const [open, setOpen] = useState<'form' | 'confirm' | 'layer' | null>(null);
  const [done, setDone] = useState(false);
  const close = () => {
    setOpen(null);
    setDone(false);
  };
  return (
    <>
      <Spec
        name="Dialog parts"
        file="components/ui-v2/dialog-parts.tsx"
        description="The one anatomy for every dialog, modelled on New client. No header or footer bars. The header row is an icon circle, the title quiet in label grey, an optional aside (Step 1 of 2) and a ghost Close at the top right. Padding is the Settings dialog's in every size: the header row 12px top and bottom with Close 12px in, so the X lands 22px from the top and right; the footer's buttons sit 22px from the right and bottom, the last one's edge under the X. The body is padded 24px, 40px in a large dialog. The footer sits right, 12px apart, the primary last. A form has no Cancel: Escape, the dimmed page and Close already leave. A confirmation (something destructive or irreversible) has a plain Cancel before its action. DoneView is where a dialog lands once its job is done."
      >
        <DemoRow>
          <Demo label="A form: no Cancel">
            <Button variant="secondary" onClick={() => setOpen('form')}>
              Open form
            </Button>
          </Demo>
          <Demo label="A confirmation: a plain Cancel">
            <Button variant="secondary" onClick={() => setOpen('confirm')}>
              Open confirmation
            </Button>
          </Demo>
        </DemoRow>
        <Dialog open={open === 'form'} onClose={close} size="form" aria-labelledby="parts-form">
          <DialogHeader id="parts-form" icon={UserPlusIcon} title="Invite a teammate" aside={done ? undefined : 'Step 1 of 1'} />
          {done ? (
            <DoneView title="Invite sent" detail="They get an email with a link to join your account." />
          ) : (
            <>
              <DialogBody className="space-y-1">
                <Input icon={UserIcon} label="Name" data-autofocus />
                <Input icon={EmailIcon} label="Email" type="email" />
              </DialogBody>
              <DialogFooter>
                <Button onClick={() => setDone(true)}>Send invite</Button>
              </DialogFooter>
            </>
          )}
        </Dialog>
        <Dialog open={open === 'confirm'} onClose={close} aria-labelledby="parts-confirm">
          <DialogHeader id="parts-confirm" icon={TrashIcon} title="Delete Sophie & James?" />
          <DialogBody>
            <p className="type-body text-zebra-600">Their proposal, invoices and notes go too. This cannot be undone.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="plain" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" onClick={close}>
              Delete client
            </Button>
          </DialogFooter>
        </Dialog>
      </Spec>
      <Spec
        name="Dialog layer"
        file="components/ui-v2/dialog-layer.tsx"
        description="What a Dialog becomes with modal={false}: the same card over the same scrim, drawn as a layer on the page (z-20) rather than in the browser's top layer, so things that portal to the page body (production's proposal editor, its text bar and popovers) show above it and can be clicked. Escape still closes it; focus is not trapped. Reach it through Dialog, never directly."
      >
        <Button variant="secondary" onClick={() => setOpen('layer')}>
          Open a layer
        </Button>
        <Dialog open={open === 'layer'} onClose={close} modal={false} size="md" aria-labelledby="parts-layer">
          <DialogHeader id="parts-layer" title="Proposal for Amelia & Jack" />
          <DialogBody>
            <p className="type-body text-zebra-600">A layer on the page, not a modal: anything portalled to the body still sits above it.</p>
          </DialogBody>
        </Dialog>
      </Spec>
    </>
  );
}
