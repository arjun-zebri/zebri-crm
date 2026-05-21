/**
 * Password-strength meter primitive.
 *
 * Renders a horizontal bar + label below a password input, giving the
 * user real-time feedback while they type. Reads the same grading
 * rule the Zod schema enforces ({@link passwordStrength}), so the
 * meter and the schema can never disagree.
 *
 * Token-driven — bar colours come from the `danger` / `warning` /
 * `success` semantic tokens so light + dark mode and brand changes
 * propagate without per-call overrides.
 *
 * @example
 * ```tsx
 * <Input type="password" value={pw} onChange={…} />
 * <PasswordStrengthMeter password={pw} />
 * ```
 *
 * @module components/auth/password-strength-meter
 */

import { passwordStrength, type PasswordStrength } from '@/lib/auth/schemas';

export interface PasswordStrengthMeterProps {
  /** The current password value. Empty → renders nothing. */
  password: string;
  /** Optional `id` for the inline `aria-describedby` link from the input. */
  id?: string;
}

const STRENGTH_CONFIG: Record<
  PasswordStrength,
  { label: string; widthClass: string; barClass: string; textClass: string }
> = {
  weak: {
    label: 'Weak',
    widthClass: 'w-1/3',
    barClass: 'bg-danger',
    textClass: 'text-danger',
  },
  medium: {
    label: 'Medium',
    widthClass: 'w-2/3',
    barClass: 'bg-warning',
    textClass: 'text-warning',
  },
  strong: {
    label: 'Strong',
    widthClass: 'w-full',
    barClass: 'bg-success',
    textClass: 'text-success',
  },
};

/** Real-time password-strength bar + label. See {@link PasswordStrengthMeterProps}. */
export function PasswordStrengthMeter({ password, id }: PasswordStrengthMeterProps) {
  const grade = passwordStrength(password);
  if (!grade) return null;
  const cfg = STRENGTH_CONFIG[grade];
  return (
    <div id={id} className="mt-2" aria-live="polite">
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full transition-all ${cfg.widthClass} ${cfg.barClass}`} />
      </div>
      <p className={`mt-1 text-caption ${cfg.textClass}`}>{cfg.label} password</p>
    </div>
  );
}
