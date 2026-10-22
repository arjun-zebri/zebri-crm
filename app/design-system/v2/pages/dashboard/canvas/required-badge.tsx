import { Badge } from '@/components/ui-v2/badge';
import { LockIcon } from '@/components/ui-v2/icons';
import { Tooltip } from '@/components/ui-v2/tooltip';

/**
 * "Required": the mark on a part the document cannot lose (an invoice's
 * total, a contract's signatures). It moves and restyles, but is never
 * deleted. One look wherever it shows: over the selection frame on the
 * page, and at the start of the toolbar.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/required-badge
 */
export function RequiredBadge({ tip = true }: { /** Explain it on hover (the toolbar); off where the pointer cannot reach it (the frame). */ tip?: boolean }) {
  const badge = (
    <Badge tone="grass" className="gap-1">
      <LockIcon aria-hidden="true" className="size-3.5" />
      Required
    </Badge>
  );
  return tip ? <Tooltip label="Moves and restyles, but stays on the document">{badge}</Tooltip> : badge;
}
