/**
 * Shared Zod schemas + helpers for the auth flows.
 *
 * One source of truth for login / signup / reset / update / change
 * password validation. Imported by:
 *   - The server actions in `app/(auth)/actions.ts`
 *     and `app/(dashboard)/settings/account/actions.ts`.
 *   - The client-side `<PasswordStrengthMeter />` primitive.
 *   - Unit tests that pin each schema's accept/reject behaviour.
 *
 * Password complexity follows the existing signup-page rule (lifted
 * out of that page into this module): length ≥ 10, with upper +
 * lower + number + special — graded into weak / medium / strong by
 * {@link passwordStrength}.
 *
 * The `next` field on the login schema is restricted to same-origin
 * relative paths (`/^\/[^/]/`) — `//evil.com` and absolute URLs are
 * rejected so the redirect-after-login can't be turned into an
 * open redirect. The middleware double-checks server-side.
 *
 * @module lib/auth/schemas
 */
import { z } from 'zod';

/**
 * Accepts only same-origin relative paths — `/couples`, `/settings`,
 * etc. Rejects `//evil.com`, `http://…`, and anything not starting
 * with a single `/` followed by a non-slash. Used for the `?next=…`
 * redirect-after-login.
 */
export const sameOriginPathSchema = z
  .string()
  .regex(/^\/[^/]/, { message: 'Must be a same-origin path starting with /' });

/**
 * Password complexity rule (mirrors the signup page's existing
 * "Strong" definition): ≥ 10 chars + upper + lower + number +
 * special. Anything weaker is rejected at the schema level.
 */
export const passwordSchema = z
  .string()
  .min(10, { message: 'Password must be at least 10 characters' })
  .regex(/[a-z]/, { message: 'Password must include a lowercase letter' })
  .regex(/[A-Z]/, { message: 'Password must include an uppercase letter' })
  .regex(/\d/, { message: 'Password must include a number' })
  .regex(/[^a-zA-Z0-9]/, { message: 'Password must include a special character' });

/** Login form payload. */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, { message: 'Password is required' }),
  next: sameOriginPathSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Signup form payload. */
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80),
  businessName: z.string().trim().min(1).max(120),
});
export type SignupInput = z.infer<typeof signupSchema>;

/** Reset-password (request email) form payload. */
export const resetPasswordRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;

/** Update-password (post-magic-link) form payload. */
export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

/** Change-password (logged-in user in Settings) form payload. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Current password is required' }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Password-strength grading used by `<PasswordStrengthMeter />`.
 *
 * The schema-level {@link passwordSchema} *rejects* anything below
 * "strong"; the meter exists to give the user real-time feedback
 * while they type, so it grades weaker passwords too rather than
 * just showing "invalid".
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong';

/**
 * Grade a password by the same rule {@link passwordSchema} enforces.
 * Returns `null` for empty input so the meter can render nothing.
 */
export function passwordStrength(password: string): PasswordStrength | null {
  if (!password) return null;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const longEnough = password.length >= 10;
  const allClasses = hasLower && hasUpper && hasDigit && hasSpecial;
  if (longEnough && allClasses) return 'strong';
  if (password.length >= 8 && (hasLower || hasUpper) && (hasDigit || hasSpecial)) return 'medium';
  return 'weak';
}
