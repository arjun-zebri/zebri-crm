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
  .refine(isSameOriginPath, { message: 'Must be a same-origin path starting with /' });

// Why each rule (Phase 4 Task 23 review, I1):
// - A backslash is read as "/" by every WHATWG URL parser for http(s), so
//   `/\evil.com` navigates to `//evil.com`.
// - Tab, CR and LF are stripped by the same parser, so `/<tab>/evil.com`
//   (from `?next=%2F%09%2Fevil.com`) also becomes `//evil.com`. Every
//   C0 control and DEL is refused, not only those three.
// - The checks run on the value AND on its percent-decoding, so a
//   double-encoded `%2F%5C` or `%09` cannot slip through a later decode.
// - Last, the value must resolve to the same origin it started from, and
//   its resolved path must not start with `//` (dot segments such as
//   `/..//evil.com` collapse to that), which catches any form the rules
//   above did not think of.
const UNSAFE_PATH_CHARS = /[\u0000-\u001f\u007f\\]/;
const SAFE_PATH_START = /^\/(?![/\\])/;
const PROBE_ORIGIN = 'https://zebri-path-probe.invalid';

function isSafePathShape(value: string): boolean {
  return SAFE_PATH_START.test(value) && !UNSAFE_PATH_CHARS.test(value);
}

/**
 * True for a same-origin relative path that is safe to redirect to:
 * `/couples`, `/settings?tab=account`. False for anything a browser could
 * turn into another origin (`//evil.com`, `/\evil.com`, `/<tab>/evil.com`,
 * encoded variants) and for anything that is not a path at all.
 */
export function isSameOriginPath(value: string): boolean {
  if (!isSafePathShape(value)) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false; // malformed percent-encoding
  }
  if (decoded !== value && !isSafePathShape(decoded)) return false;
  try {
    const resolved = new URL(value, PROBE_ORIGIN);
    // Same origin is not enough: `/..//evil.com` resolves on this origin
    // to the PATH `//evil.com`, which any later consumer that forwards
    // `url.pathname` would turn back into a protocol-relative redirect.
    return resolved.origin === PROBE_ORIGIN && !resolved.pathname.startsWith('//');
  } catch {
    return false;
  }
}

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

/**
 * A 2FA recovery code as typed on the second-factor screen (Phase 4,
 * Task 23). Loose on purpose: case, spaces and the hyphen are all
 * forgiven by `normaliseRecoveryCode` before matching, so this only
 * bounds the length and rejects anything outside the code alphabet's
 * character classes.
 */
export const recoveryCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(10, { message: 'Enter the full recovery code.' })
    .max(24, { message: 'That is longer than a recovery code.' })
    .regex(/^[A-Za-z0-9\s-]+$/, { message: 'Recovery codes use only letters, numbers and a hyphen.' }),
});
export type RecoveryCodeInput = z.infer<typeof recoveryCodeSchema>;
