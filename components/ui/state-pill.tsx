/**
 * Shared status-indicator pill.
 *
 * A small tonal chip with an optional leading dot. Used across the
 * Billing tab, the Quote builder, the Invoice builder, and anywhere
 * else a "what state is this thing in?" badge appears. Token-clean
 * by design — five tones plus a neutral default, no raw colours.
 *
 * @example
 * ```tsx
 * <StatePill label="Active" tone="success" dot />
 * <StatePill label="Draft" tone="neutral" />
 * <StatePill label="Due" tone="warning" dot="hollow" />
 * <StatePill label="Immediately" icon={CalendarClock} />
 * <StatePill label="Subject is required." tone="warning" icon={AlertTriangle} wrap />
 * ```
 *
 * @module components/ui/state-pill
 */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type StatePillTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export type StatePillDot = false | 'filled' | 'hollow';

export interface StatePillProps {
  /** Visible text. Kept short — pills are not for prose. */
  label: ReactNode;
  /** Semantic tone. Drives both background and text colour via tokens. */
  tone?: StatePillTone;
  /**
   * Optional leading dot. `'filled'` = strong active state
   * (Active, Paid, Accepted). `'hollow'` = waiting / due state
   * (Due, Sent, Pending). `false` = no dot.
   */
  dot?: StatePillDot;
  /**
   * Optional leading Lucide icon, drawn at 12px and the house 1.5
   * stroke, hidden from screen readers (the label carries the meaning).
   * Used instead of a dot where the pill names a kind of thing, such as
   * a workflow card's timing or an unfinished step.
   */
  icon?: LucideIcon;
  /**
   * Let a sentence-length label wrap inside its container rather than
   * overflow it. For a pill whose text is the fix ("Subject is
   * required."), which truncating would hide. A wrapped pill takes
   * `rounded-control`, since a pill radius on two lines cuts into the text.
   */
  wrap?: boolean;
  /** Optional extra classes — useful for layout adjustments. */
  className?: string;
}

const TONE_CLASSES: Record<StatePillTone, string> = {
  // Neutral = muted bg, muted text. Used for Draft / Free plan /
  // terminal states (Ended, Expired, Cancelled) where the row
  // shouldn't draw attention.
  neutral: 'bg-surface-muted text-text-muted',
  // Info = blue tones. Used for Sent (the document is out, awaiting
  // response).
  info: 'bg-info/10 text-info',
  // Success = emerald tones. Used for Active / Accepted / Paid.
  success: 'bg-success/10 text-success',
  // Warning = amber tones. Used for Cancelling-in-grace / Deposit
  // paid / Due.
  warning: 'bg-warning/10 text-warning',
  // Danger = red tones. Used for Past due / Declined / Overdue.
  danger: 'bg-danger/10 text-danger',
};

const DOT_BG_BY_TONE: Record<StatePillTone, string> = {
  neutral: 'bg-text-muted',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function StatePill({
  label,
  tone = 'neutral',
  dot = false,
  icon: Icon,
  wrap = false,
  className,
}: StatePillProps) {
  // A wrapped pill aligns its icon with the first line, not the middle,
  // and takes the control radius: a full pill radius on two lines curves
  // the tint away from the first and last glyphs of each line.
  const layout = wrap ? 'max-w-full items-start rounded-control' : 'items-center rounded-pill';
  return (
    <span
      className={`inline-flex ${layout} gap-1.5 px-2 py-0.5 text-body font-medium ${TONE_CLASSES[tone]}${
        className ? ` ${className}` : ''
      }`}
    >
      {Icon ? (
        <Icon size={12} strokeWidth={1.5} aria-hidden className={`shrink-0${wrap ? ' mt-1' : ''}`} />
      ) : null}
      {dot === 'filled' ? (
        <span
          className={`h-1.5 w-1.5 rounded-pill ${DOT_BG_BY_TONE[tone]}`}
          aria-hidden
        />
      ) : dot === 'hollow' ? (
        <span
          className={`h-1.5 w-1.5 rounded-pill border ${dotBorderForTone(tone)}`}
          aria-hidden
        />
      ) : null}
      {wrap ? <span className="min-w-0">{label}</span> : label}
    </span>
  );
}

function dotBorderForTone(tone: StatePillTone): string {
  // Hollow dots use a coloured border matching the tone (the inner
  // is transparent against the tonal pill background). Tailwind
  // doesn't have a `border-info` token by default — we use `border-{tone}`
  // via the same token set the bg uses, falling back to text colour.
  switch (tone) {
    case 'neutral':
      return 'border-text-muted';
    case 'info':
      return 'border-info';
    case 'success':
      return 'border-success';
    case 'warning':
      return 'border-warning';
    case 'danger':
      return 'border-danger';
  }
}
