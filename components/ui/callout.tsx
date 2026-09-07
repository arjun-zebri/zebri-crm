import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Canonical inline note primitive.
 *
 * A sentence that changes what the user should expect - "nothing behind
 * this runs until you tick it", "this card is about to expire" - set
 * apart from the form it sits in. Muted body text under a control says
 * the same words in the same weight as every caption on the page, so
 * the one line that matters reads as the one line nobody notices.
 *
 * Reach for it when the sentence carries a consequence. A caption that
 * merely restates what a field does ("Added to the timeline when this
 * runs") stays `text-text-muted` prose: promoting those too would put
 * four coloured boxes in one modal and flatten the distinction again.
 *
 * @example
 * ```tsx
 * <Callout tone="warning">
 *   This to-do is yours to tick off. Nothing anchored after it runs
 *   until you do.
 * </Callout>
 * ```
 *
 * @module components/ui/callout
 */

/** Semantic colour of a callout. */
export type CalloutTone = 'warning' | 'info' | 'success' | 'danger';

export interface CalloutProps {
  /** Semantic colour. Defaults to `info`. */
  tone?: CalloutTone;
  /** The note. Plain prose, one or two sentences. */
  children: ReactNode;
  /**
   * Replaces the tone's default icon. Pass `null` for no icon at all -
   * for a callout inside a list of them, where four identical glyphs
   * are noise.
   */
  icon?: LucideIcon | null;
  /** Extra classes on the outermost element. */
  className?: string;
}

/**
 * Per-tone icon and colours. Both the border and the fill are the tone
 * at low opacity so the box tints rather than shouts: the text stays
 * `text-text` and carries the sentence, exactly as it would in prose.
 */
const TONES: Record<CalloutTone, { icon: LucideIcon; box: string; mark: string }> = {
  warning: {
    icon: AlertTriangle,
    box: 'border-warning/40 bg-warning/10',
    mark: 'text-warning',
  },
  info: {
    icon: Info,
    box: 'border-info/40 bg-info/10',
    mark: 'text-info',
  },
  success: {
    icon: CheckCircle2,
    box: 'border-success/40 bg-success/10',
    mark: 'text-success',
  },
  danger: {
    icon: AlertCircle,
    box: 'border-danger/40 bg-danger/10',
    mark: 'text-danger',
  },
};

/** Token-driven inline note. See {@link CalloutProps}. */
export function Callout({ tone = 'info', children, icon, className }: CalloutProps) {
  const spec = TONES[tone];
  // `undefined` means "use the tone's icon"; `null` means "no icon".
  const Icon = icon === undefined ? spec.icon : icon;
  return (
    <div
      className={`flex items-start gap-2 rounded-control border px-3 py-2 text-body text-text ${spec.box}${
        className ? ` ${className}` : ''
      }`}
    >
      {Icon ? (
        <Icon size={16} strokeWidth={1.5} className={`mt-0.5 shrink-0 ${spec.mark}`} aria-hidden />
      ) : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
