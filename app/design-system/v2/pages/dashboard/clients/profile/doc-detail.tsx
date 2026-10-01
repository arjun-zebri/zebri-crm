import { Button } from '@/components/ui-v2/button';

import { StatusText } from './doc-row';
import type { Doc } from './profile-data';

/**
 * The Documents panel: the selected document's preview, its title and
 * where it stands, the facts that matter for it (who it went to, whether
 * they opened it, what it needs), then the thing to do about it beside
 * Download. The preview is a striped stand-in in this demo.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/doc-detail
 */

/** The selected document in full. */
export function DocDetail({ doc: d }: { doc: Doc }) {
  return (
    <div className="space-y-6">
      {/* Below lg this opens under its own row, which already names it:
          the preview, title and status would only repeat it. */}
      <div className="hidden aspect-[4/3] items-center justify-center rounded-panel border border-zebra-200 lg:flex bg-[repeating-linear-gradient(135deg,var(--color-zebra-100)_0_10px,transparent_10px_20px)]">
        <span className="type-code text-zebra-400">{d.title} preview</span>
      </div>
      <div className="hidden space-y-1 lg:block">
        <h3 className="type-subheading text-zebra-950">{d.title}</h3>
        <StatusText status={d.status} state={d.state} />
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
