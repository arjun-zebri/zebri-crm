'use client';

/**
 * One prospect in the Needs-review queue, with the decision buttons.
 *
 * Shortcut letters are shown on the buttons so the keyboard is
 * discoverable; the handling itself lives in {@link ReviewQueue}.
 *
 * @module features/outreach/views/checks/review-card
 */
import { Button } from '@/components/ui/button';
import type { Prospect } from '@/lib/outreach/types';

import { formatDay } from './format';
import { httpUrlOrNull, siteStatusLabel } from './site-status';

/** Strip a leading @ so a stored handle always builds a clean URL. */
function instagramUrl(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle.replace(/^@/, ''))}`;
}

/**
 * @param props.prospect - The prospect on screen.
 * @param props.pending - True while a verdict save is in flight.
 * @param props.onDecide - Called with 'active' or 'inactive'.
 * @param props.onSkip - Move to the next prospect without deciding.
 */
export function ReviewCard({
  prospect,
  pending,
  onDecide,
  onSkip,
}: {
  prospect: Prospect;
  pending: boolean;
  onDecide: (verdict: 'active' | 'inactive') => void;
  onSkip: () => void;
}) {
  const place = [prospect.suburb, prospect.state].filter(Boolean).join(', ');
  const siteHref = httpUrlOrNull(prospect.website);
  const linkClass = 'text-text underline underline-offset-2 cursor-pointer break-all';
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-section font-semibold text-text">{prospect.full_name}</h3>
        {place && <p className="text-body text-text-muted">{place}</p>}
      </div>
      <dl className="space-y-3 text-body">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-text-muted">Website</dt>
          <dd>
            {prospect.website ? (
              // Why: imported text is not always a URL, so only a valid http(s) address becomes a link.
              siteHref ? (
                <a href={siteHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {prospect.website}
                </a>
              ) : (
                <span className="text-text break-all">{prospect.website}</span>
              )
            ) : (
              <span className="text-text-muted">None</span>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-text-muted">Instagram</dt>
          <dd>
            {prospect.instagram_handle ? (
              <a
                href={instagramUrl(prospect.instagram_handle)}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                @{prospect.instagram_handle.replace(/^@/, '')}
              </a>
            ) : (
              <span className="text-text-muted">None</span>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-text-muted">Website status</dt>
          <dd className="text-text">{siteStatusLabel(prospect.site_status)}</dd>
        </div>
        {prospect.site_latest_year != null && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-text-muted">Latest wedding year</dt>
            <dd className="text-text">{prospect.site_latest_year}</dd>
          </div>
        )}
        {prospect.ig_last_post_at && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-text-muted">Last Instagram post</dt>
            <dd className="text-text">{formatDay(prospect.ig_last_post_at)}</dd>
          </div>
        )}
        {prospect.verdict_reason && <p className="text-text-muted">{prospect.verdict_reason}</p>}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" loading={pending} onClick={() => onDecide('active')}>
          Active <span className="ml-1 opacity-70">A</span>
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => onDecide('inactive')}>
          Inactive <span className="ml-1 text-text-muted">I</span>
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onSkip}>
          Skip <span className="ml-1 text-text-muted">S</span>
        </Button>
      </div>
    </div>
  );
}
