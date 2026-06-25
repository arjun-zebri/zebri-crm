/**
 * Unit tests for `dispatchEmail` (`lib/email/dispatch`): the transport
 * router. Verifies OAuth sends hit the Gmail / Microsoft Graph endpoints,
 * default sends go through Resend, and all surface failures as
 * `{ ok: false }` rather than throwing. The Resend client + `fetch` are
 * mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resendSendMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: resendSendMock } })),
}));

process.env.RESEND_API_KEY = 'test-key';
 
global.fetch = fetchMock as any;

import { dispatchEmail } from '@/lib/email/dispatch';
import type { ResolvedSender } from '@/lib/email/sender-identity';

const gmailSender: ResolvedSender = {
  transport: 'oauth',
  from: '"Jane" <jane@gmail.com>',
  oauth: { provider: 'google', accessToken: 'tok-g' },
};
const outlookSender: ResolvedSender = {
  transport: 'oauth',
  from: '"Jane" <jane@outlook.com>',
  oauth: { provider: 'microsoft', accessToken: 'tok-m' },
};
const resendSender: ResolvedSender = { transport: 'resend', from: 'Zebri <noreply@app.zebri.com.au>' };
const payload = { to: 'couple@example.com', subject: 'Hi', html: '<p>Hi</p>' };

beforeEach(() => {
  resendSendMock.mockReset();
  fetchMock.mockReset();
});

describe('dispatchEmail', () => {
  it('sends a Google mailbox via the Gmail API', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-1' }) });
    const res = await dispatchEmail(gmailSender, payload);
    expect(res).toEqual({ ok: true, messageId: 'g-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(JSON.parse(init.body).raw).toEqual(expect.any(String));
    expect(init.headers.Authorization).toBe('Bearer tok-g');
  });

  it('sends a Microsoft mailbox via Graph (202 = ok)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202, json: async () => ({}) });
    const res = await dispatchEmail(outlookSender, payload);
    expect(res.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://graph.microsoft.com/v1.0/me/sendMail');
  });

  it('sends the default sender through Resend', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-1' }, error: null });
    const res = await dispatchEmail(resendSender, payload);
    expect(res).toEqual({ ok: true, messageId: 'r-1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns ok:false when the Gmail API rejects', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid token' } }) });
    const res = await dispatchEmail(gmailSender, payload);
    expect(res).toEqual({ ok: false, error: 'invalid token' });
  });

  it('returns ok:false (never throws) when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const res = await dispatchEmail(outlookSender, payload);
    expect(res).toEqual({ ok: false, error: 'network down' });
  });
});
