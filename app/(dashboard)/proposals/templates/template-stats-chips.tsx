/**
 * The outcome chips over a template card's thumbnail (top-left): sent
 * count, acceptance rate and revenue won, each an icon and a figure with
 * the full "5 sent" reading in a tooltip and as screen-reader text. The
 * number an MC actually wants from a template is "does this one close?",
 * which the old sent/viewed/accepted chip floating over the thumbnail
 * never answered; the caption line that replaced it read as a second,
 * unrelated sentence under the name, so the figures moved onto the
 * picture (2026-09-19 on the founder's ask).
 *
 * Renders nothing when nothing has been sent: a "0" chip on a fresh
 * template is noise, and the card already says what it is.
 *
 * Placeholder: renders a {@link TemplateStats}; today the caller passes
 * `SAMPLE_TEMPLATE_STATS`, with no "Sample data" pill. Real figures need
 * `proposals.template_id` to be written at create time, then a count/sum
 * grouped by it.
 *
 * @module app/(dashboard)/proposals/templates/template-stats-chips
 */
'use client';

import { CircleCheck, DollarSign, Send } from 'lucide-react';

import { Tooltip } from '@/components/ui/tooltip';

import { acceptanceRate, type TemplateStats } from '../analytics-placeholders';

const money = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

export interface TemplateStatsChipsProps {
  stats: TemplateStats;
}

interface Chip {
  Icon: typeof Send;
  /** The short figure shown in the chip. */
  value: string;
  /** The full reading, for the tooltip and screen readers. */
  label: string;
}

/** See {@link TemplateStatsChipsProps}. */
export function TemplateStatsChips({ stats }: TemplateStatsChipsProps) {
  const rate = acceptanceRate(stats);
  if (rate === null) return null;
  const chips: Chip[] = [
    { Icon: Send, value: String(stats.sent), label: `${stats.sent} sent` },
    { Icon: CircleCheck, value: `${rate}%`, label: `${rate}% accepted` },
    { Icon: DollarSign, value: money(stats.revenue), label: `${money(stats.revenue)} won` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map(({ Icon, value, label }) => (
        <Tooltip key={label} label={label}>
          {/* A solid surface, not a translucent one: the chip sits on top
              of the thumbnail and a see-through pill let the page's own
              text ghost through the figures. */}
          <span className="inline-flex h-6 items-center gap-1 rounded-pill border border-border bg-surface px-2 text-body text-text shadow-sm">
            <Icon size={12} strokeWidth={1.5} aria-hidden="true" />
            <span aria-hidden="true">{value}</span>
            <span className="sr-only">{label}</span>
          </span>
        </Tooltip>
      ))}
    </div>
  );
}
