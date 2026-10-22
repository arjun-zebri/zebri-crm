'use client';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { FilePlusIcon } from '@/components/ui-v2/icons';

import { DesignButton } from '../../canvas/docs/design-button';
import { useDesigning } from '../../canvas/docs/design-store';
import type { DesignKind } from '../../canvas/docs/spec';

/**
 * Where every way into the builder lands in this preview (New proposal
 * after picking a couple and template, Edit on a proposal or template,
 * New template): a small dialog on the v2 anatomy that names what would
 * open (the quiet title, what it is for under it) and says the builder is
 * still to come, so the flow's shape is there without
 * pretending to save anything. Opens in front of whatever opened it.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/modal/builder-stub
 */

/** What the builder would open on. */
export interface StubFor {
  title: string;
  /** Who or what it is for: "Sophie & Max · Full day MC". */
  context: string;
  /** What the builder will do, in place of the proposal builder's line. */
  note?: string | undefined;
  /** The design this kind of document wears, offered while the builder is still to come. */
  design?: DesignKind | undefined;
}

/** The builder stub. Closed while `stub` is null. */
export function BuilderStub({ stub, onClose }: { stub: StubFor | null; onClose: () => void }) {
  // Out of the way while Design is open over it (see `useDesigning`).
  const designing = useDesigning();
  return (
    <Dialog open={stub !== null && !designing} onClose={onClose} aria-labelledby="builder-stub-title">
      <DialogHeader id="builder-stub-title" icon={FilePlusIcon} title={stub?.title ?? ''} />
      <DialogBody className="space-y-2">
        <p className="type-subheading text-zebra-950">{stub?.context}</p>
        <p className="type-body text-zebra-500">
          {stub?.note ?? <>The builder is coming soon. You&rsquo;ll lay out the page, pick the packages and send it from here.</>}
        </p>
      </DialogBody>
      <DialogFooter>
        {stub?.design ? <DesignButton kind={stub.design} /> : null}
        <Button variant={stub?.design ? 'primary' : 'secondary'} onClick={onClose} data-autofocus>
          Got it
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
