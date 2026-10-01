'use client';

import { FilePlus2 } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

/**
 * Where every way into the builder lands in this preview (New proposal
 * after picking a couple and template, Edit on a proposal or template,
 * New template): a small dialog that names what would open and says the
 * builder is still to come, so the flow's shape is there without
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
}

/** The builder stub. Closed while `stub` is null. */
export function BuilderStub({ stub, onClose }: { stub: StubFor | null; onClose: () => void }) {
  return (
    <Dialog open={stub !== null} onClose={onClose} aria-labelledby="builder-stub-title">
      <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-8 text-center">
        <FilePlus2 aria-hidden="true" strokeWidth={1.5} className="size-6 text-zebra-400" />
        <div className="space-y-1">
          <h2 id="builder-stub-title" className="type-subheading text-zebra-950">
            {stub?.title}
          </h2>
          <p className="type-body text-zebra-500">{stub?.context}</p>
        </div>
        <p className="max-w-xs type-body text-zebra-500">
          {stub?.note ?? <>The builder is coming soon. You&rsquo;ll lay out the page, pick the packages and send it from here.</>}
        </p>
        <Button variant="secondary" onClick={onClose} className="mt-2" data-autofocus>
          Got it
        </Button>
      </div>
    </Dialog>
  );
}
