// @vitest-environment node
/**
 * `enterShadow` two-factor requirement (Task 23 review, I3). Shadow mode
 * waives the target's second factor, so the admin must have two-factor
 * sign-in on and have passed it in this session. The rest of shadow mode
 * (grant, exit, refusals) is covered by the hotfix's exit-shadow.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'unit-test-service-role-key';
const ADMIN = '11111111-1111-4111-8111-111111111111';
const MC = '22222222-2222-4222-8222-222222222222';

function token(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

const m = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  sessionUser: null as null | Record<string, unknown>,
  aal: 'aal1',
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (m.jar.has(k) ? { value: m.jar.get(k) } : undefined),
    set: (k: string, v: string) => void m.jar.set(k, v),
    delete: (k: string) => void m.jar.delete(k),
  }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/payments/stripe', () => ({ stripe: {} }));
vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn() }));
vi.mock('@/lib/admin/audit', () => ({ recordAdminAction: vi.fn() }));
// Task 25 records the minted session; stubbed here, covered in exit-shadow.test.ts.
vi.mock('@/lib/admin/shadow-sessions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/shadow-sessions')>()),
  startShadowSession: vi.fn(async () => null),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: m.sessionUser } }),
      getSession: async () => ({ data: { session: { access_token: token({ aal: m.aal }) } } }),
      verifyOtp: m.verifyOtp,
    },
  }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: { id, email: 'mc@example.test', app_metadata: { account_type: 'vendor' } } },
          error: null,
        }),
        generateLink: m.generateLink,
      },
    },
  }),
}));

import { enterShadow } from '@/app/admin/actions';

const admin = {
  id: ADMIN,
  email: 'admin@example.test',
  app_metadata: { account_type: 'admin' },
  factors: [{ status: 'verified', factor_type: 'totp' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  m.jar.clear();
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  m.generateLink.mockResolvedValue({ data: { properties: { email_otp: '123456' } }, error: null });
  m.verifyOtp.mockResolvedValue({
    data: { session: { access_token: token({ session_id: '44444444-4444-4444-8444-444444444444' }) } },
    error: null,
  });
});

describe('enterShadow two-factor requirement', () => {
  it('refuses an admin without two-factor sign-in, and sets no cookie', async () => {
    m.sessionUser = { ...admin, factors: [] };
    m.aal = 'aal2';
    expect(await enterShadow(MC)).toEqual({ error: expect.stringMatching(/Turn on two-factor/) });
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.jar.size).toBe(0);
  });

  it('refuses an admin with 2FA who has not passed it this session', async () => {
    m.sessionUser = admin;
    m.aal = 'aal1';
    expect(await enterShadow(MC)).toEqual({ error: expect.stringMatching(/authenticator code/) });
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.jar.size).toBe(0);
  });

  it('lets an aal2 admin with 2FA in', async () => {
    m.sessionUser = admin;
    m.aal = 'aal2';
    await expect(enterShadow(MC)).rejects.toThrow('REDIRECT:/');
    expect(m.verifyOtp).toHaveBeenCalledTimes(1);
    expect(m.jar.get('zebri_shadow_grant')).toMatch(/^v1\./);
  });
});
