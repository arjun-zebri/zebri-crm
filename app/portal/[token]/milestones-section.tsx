'use client';

/**
 * "Where we are up to", on the couple's own page.
 *
 * The most common interruption in an MC's week is a couple emailing to
 * ask whether anything is happening. This answers it before they ask,
 * and it costs the MC one toggle per step rather than an email.
 *
 * Only steps the MC deliberately marked visible appear here, and only as
 * done or upcoming. A couple never sees that something failed, and never
 * sees a step the MC skipped presented as skipped: neither is their
 * business, and both read as something going wrong.
 *
 * @module app/portal/[token]/milestones-section
 */

import { Check, Circle } from 'lucide-react';

/** One milestone as `get_portal_milestones` returns it. */
export interface PortalMilestone {
  id: string;
  title: string;
  note: string | null;
  status: 'done' | 'upcoming';
  due_at: string | null;
}

export interface MilestonesSectionProps {
  milestones: PortalMilestone[];
  /** Branding text colour, matching the rest of the portal sections. */
  textColor: string;
  mutedColor: string;
}

/** `12 September` for a date the couple can act on. */
function friendly(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
}

/** The milestone list. See {@link MilestonesSectionProps}. */
export function MilestonesSection({
  milestones,
  textColor,
  mutedColor,
}: MilestonesSectionProps) {
  if (milestones.length === 0) return null;

  const done = milestones.filter((m) => m.status === 'done').length;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section font-semibold" style={{ color: textColor }}>
          Where we are up to
        </h2>
        <span className="text-body" style={{ color: mutedColor }}>
          {done} of {milestones.length} done
        </span>
      </div>

      <ol className="space-y-2">
        {milestones.map((milestone) => {
          const when = friendly(milestone.due_at);
          return (
            <li key={milestone.id} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0" style={{ color: mutedColor }}>
                {milestone.status === 'done' ? (
                  <Check size={16} strokeWidth={1.5} aria-label="Done" />
                ) : (
                  <Circle size={16} strokeWidth={1.5} aria-label="Still to come" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-body"
                  style={{
                    color: milestone.status === 'done' ? mutedColor : textColor,
                  }}
                >
                  {milestone.title}
                </span>
                {milestone.note ? (
                  <span className="block text-body" style={{ color: mutedColor }}>
                    {milestone.note}
                  </span>
                ) : null}
              </span>
              {when && milestone.status === 'upcoming' ? (
                <span className="shrink-0 text-body" style={{ color: mutedColor }}>
                  {when}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
