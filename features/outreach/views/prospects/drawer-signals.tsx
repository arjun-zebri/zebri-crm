/**
 * What the checks found, in two sentences: one for the website, one for
 * Instagram. Read-only, because these come from the checks, not from the
 * founder. A table of every field read as noise; the sentence keeps the
 * facts that decide whether someone is active.
 *
 * @module features/outreach/views/prospects/drawer-signals
 */
import type { Prospect } from '@/lib/outreach/types';

import { DrawerSection } from './drawer-parts';
import { IG_STATUS_LABELS, SITE_STATUS_LABELS, formatRelative, humanize } from './labels';

/** Props for {@link SignalsSection}. */
export interface SignalsSectionProps {
  prospect: Prospect;
}

/** "Website: Live, mentions weddings, latest year 2026." */
function websiteLine(p: Prospect): string {
  if (!p.site_status) return 'Not checked';
  const parts = [SITE_STATUS_LABELS[p.site_status] ?? humanize(p.site_status)];
  if (p.site_has_wedding_content) parts.push('mentions weddings');
  if (p.site_latest_year !== null) parts.push(`latest year ${p.site_latest_year}`);
  return parts.join(', ');
}

/** "Instagram: Public account, posted 11 days ago, 57 followers." */
function instagramLine(p: Prospect): string {
  if (!p.ig_status) return 'Not checked';
  const parts = [IG_STATUS_LABELS[p.ig_status] ?? humanize(p.ig_status)];
  if (p.ig_last_post_at) parts.push(`posted ${formatRelative(p.ig_last_post_at)}`);
  if (p.ig_followers !== null) parts.push(`${p.ig_followers.toLocaleString('en-AU')} followers`);
  return parts.join(', ');
}

/** Website and Instagram check results, one line each. */
export function SignalsSection({ prospect: p }: SignalsSectionProps) {
  const neverChecked = !p.site_checked_at && !p.ig_checked_at;
  return (
    <DrawerSection title="Checks">
      {neverChecked ? (
        <p className="text-body text-text-muted">Not checked yet. Run a check from this page.</p>
      ) : (
        <div className="space-y-1 text-body">
          <p><span className="text-text-muted">Website:</span> <span className="text-text">{websiteLine(p)}</span></p>
          <p><span className="text-text-muted">Instagram:</span> <span className="text-text">{instagramLine(p)}</span></p>
        </div>
      )}
    </DrawerSection>
  );
}
