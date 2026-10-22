import { IconCircle } from '@/components/ui-v2/icon-circle';
import { FilePlusIcon } from '@/components/ui-v2/icons';

/**
 * What New invoice and New contract open onto in this preview: a blank
 * page (the paper look every preview shares: `DocumentPage`'s corners,
 * shadow and hairline) that says the builder is still to come, so the
 * flow's shape is there without pretending to save anything.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/new-document
 */

/** The blank page. */
export function NewDocument({ kind }: { kind: 'invoice' | 'contract' }) {
  return (
    <div className="flex aspect-[3/4] max-h-[32rem] w-full flex-col items-center justify-center gap-3 rounded-check bg-field p-8 text-center shadow-lg ring-1 ring-hairline">
      <IconCircle size="lg" icon={FilePlusIcon} />
      <p className="type-label text-zebra-950">Builder coming soon</p>
      <p className="max-w-xs type-body text-zebra-500">
        {kind === 'invoice'
          ? 'Pick a client and a package, set the payment plan, and Zebri sends each invoice on time.'
          : 'Start from your contract template, pick the client, and send it for signing.'}
      </p>
    </div>
  );
}
