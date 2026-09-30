/**
 * Devices the proposal was opened on: one muted line of session counts
 * ("3 sessions: 2 phone, 1 desktop") under the same heading style as the
 * section and package blocks.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-device-split
 */
import { Monitor, Smartphone, Tablet, type LucideIcon } from 'lucide-react';

import type { DeviceSplit } from '@/features/proposals';

const BUCKETS: Array<{ key: keyof DeviceSplit; icon: LucideIcon | null }> = [
  { key: 'phone', icon: Smartphone },
  { key: 'tablet', icon: Tablet },
  { key: 'desktop', icon: Monitor },
  { key: 'unknown', icon: null },
];

export interface ProposalDeviceSplitProps {
  split: DeviceSplit;
}

/**
 * Renders nothing for a proposal with no sessions (the caller's empty
 * state covers that). Zero buckets are omitted, and "unknown" only shows
 * when non-zero, since v1-era rows carry no device and a permanent
 * "0 unknown" would read as noise.
 */
export function ProposalDeviceSplit({ split }: ProposalDeviceSplitProps) {
  const total = split.phone + split.tablet + split.desktop + split.unknown;
  if (total === 0) return null;
  const parts = BUCKETS.filter((b) => split[b.key] > 0);

  // One text node for the sentence (screen readers and tests read it whole);
  // the icons are decoration in front of it.
  const sentence = `${total} session${total === 1 ? '' : 's'}: ${parts.map((b) => `${split[b.key]} ${b.key}`).join(', ')}`;

  return (
    <div className="space-y-2">
      <h3 className="text-body font-medium text-text">Devices</h3>
      <div className="flex items-center gap-2 text-body text-text-muted">
        {parts.map(({ key, icon: Icon }) =>
          Icon ? <Icon key={key} className="size-4 shrink-0" strokeWidth={1.5} aria-hidden /> : null,
        )}
        <p>{sentence}</p>
      </div>
    </div>
  );
}
