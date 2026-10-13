'use client';

/**
 * "Ready to send": the setup checklist for Settings and Campaigns, in the
 * order the founder should work through it. Each missing required row
 * links to the Settings section that fixes it. Optional rows (Instagram
 * lookups) are muted and never link or count. Rows come from
 * `lib/outreach/readiness`, so this list and the Activate guard agree.
 *
 * @module features/outreach/views/readiness/ready-to-send-checklist
 */
import { Circle, CircleCheck } from 'lucide-react';
import Link from 'next/link';

import { buttonClassName } from '@/components/ui/button';
import { requiredMissing, type ReadinessAnchor, type ReadinessItem } from '@/lib/outreach/readiness';

/** Props for {@link ReadyToSendChecklist}. */
export interface ReadyToSendChecklistProps {
  items: ReadinessItem[];
  /** Builds the link target for a Settings section. Settings uses in-page hashes; Campaigns links out. */
  hrefFor: (anchor: ReadinessAnchor) => string;
  /** Render nothing once every shown required row is done. Campaigns uses this; Settings keeps the list as a status panel. */
  hideWhenComplete?: boolean;
}

/** The checklist card. Rows that do not apply to the account are not shown at all. */
export function ReadyToSendChecklist({ items, hrefFor, hideWhenComplete = false }: ReadyToSendChecklistProps) {
  const shown = items.filter((i) => i.shown);
  const missing = requiredMissing(items);
  if (hideWhenComplete && missing.length === 0) return null;

  return (
    <section aria-labelledby="ready-to-send-heading" className="rounded-control border border-border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <h2 id="ready-to-send-heading" className="text-body font-semibold text-text">
          Ready to send
        </h2>
        <p className="text-body text-text-muted">
          {missing.length === 0
            ? 'Everything is set up. Campaigns can start.'
            : `${missing.length} ${missing.length === 1 ? 'thing' : 'things'} to set up before campaigns can send.`}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {shown.map((item) => (
          <ChecklistRow key={item.key} item={item} href={hrefFor(item.anchor)} />
        ))}
      </ul>
    </section>
  );
}

/** One checklist row. Required and missing rows get a Fix link; optional rows are muted and never do. */
function ChecklistRow({ item, href }: { item: ReadinessItem; href: string }) {
  const showFix = !item.done && !item.optional;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        {item.done ? (
          <CircleCheck size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-success" aria-hidden />
        ) : (
          <Circle
            size={16}
            strokeWidth={1.5}
            className={`mt-0.5 shrink-0 ${item.optional ? 'text-text-subtle' : 'text-warning'}`}
            aria-hidden
          />
        )}
        <div className="min-w-0">
          <p className={item.optional && !item.done ? 'text-body font-medium text-text-muted' : 'text-body font-medium text-text'}>
            {item.label}
            {item.optional && <span className="text-text-subtle"> (optional)</span>}
            <span className="sr-only">{item.done ? ' (done)' : ' (missing)'}</span>
          </p>
          <p className="text-body text-text-muted">{item.detail}</p>
        </div>
      </div>
      {showFix && (
        <Link href={href} className={buttonClassName({ variant: 'outline' })}>
          Fix
        </Link>
      )}
    </li>
  );
}
