import { FilePlus2 } from 'lucide-react';

/**
 * What New invoice and New contract open onto in this preview: a blank
 * page that says the builder is still to come, so the flow's shape is
 * there without pretending to save anything.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/new-document
 */

/** The blank page. */
export function NewDocument({ kind }: { kind: 'invoice' | 'contract' }) {
  return (
    <div className="flex aspect-[3/4] max-h-[32rem] w-full flex-col items-center justify-center gap-3 rounded-panel bg-field p-8 text-center shadow-sm ring-1 ring-zebra-950/5">
      <FilePlus2 aria-hidden="true" strokeWidth={1.5} className="size-6 text-zebra-400" />
      <p className="type-label text-zebra-950">Builder coming soon</p>
      <p className="max-w-xs type-body text-zebra-500">
        {kind === 'invoice'
          ? 'Pick a client and a package, set the payment plan, and Zebri sends each invoice on time.'
          : 'Start from your contract template, pick the client, and send it for signing.'}
      </p>
    </div>
  );
}
