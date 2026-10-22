import { Button } from '@/components/ui-v2/button';

import type { Doc } from './profile-data';

/**
 * What opens under a document's row when it has no editor of its own
 * (an invoice, a shared file): its preview, the facts that matter for it (who it went to, whether
 * they opened it, what it needs), then the thing to do about it beside
 * Download. The preview is a grey stand-in in this demo.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/doc-detail
 */

/** The selected document in full. */
export function DocDetail({ doc: d }: { doc: Doc }) {
  return (
    <div className="space-y-6">
      {/* It opens under its own row, which already names it and says
          where it stands (user, 2026-10-15), so no title or status here. */}
      <div className="hidden aspect-[4/3] items-center justify-center rounded-panel bg-hover lg:flex">
        <span className="type-code text-zebra-400">{d.title} preview</span>
      </div>
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-3.5 type-body">
        {d.facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-zebra-500">{f.label}</dt>
            <dd className="text-zebra-950">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        {d.action ? <Button>{d.action}</Button> : null}
        <Button variant="secondary">Download</Button>
      </div>
    </div>
  );
}
