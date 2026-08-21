import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthorizeUrl,
  isOAuthPurpose,
  oauthConfig,
  parseOAuthState,
} from '@/lib/oauth/providers';

describe('purpose-aware OAuth config', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'gid');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'gsecret');
    vi.stubEnv('MICROSOFT_OAUTH_CLIENT_ID', 'mid');
    vi.stubEnv('MICROSOFT_OAUTH_CLIENT_SECRET', 'msecret');
  });

  it('email purpose keeps the existing mail scopes', () => {
    expect(oauthConfig('google').scopes).toContain(
      'https://www.googleapis.com/auth/gmail.send',
    );
    expect(oauthConfig('google', 'email').scopes).not.toContain(
      'https://www.googleapis.com/auth/calendar.events',
    );
  });

  it('calendar purpose requests calendar scopes, not mail scopes', () => {
    const g = oauthConfig('google', 'calendar').scopes;
    expect(g).toContain('https://www.googleapis.com/auth/calendar.events');
    expect(g).toContain('https://www.googleapis.com/auth/calendar.freebusy');
    expect(g).not.toContain('https://www.googleapis.com/auth/gmail.send');

    const m = oauthConfig('microsoft', 'calendar').scopes;
    expect(m).toContain('https://graph.microsoft.com/Calendars.ReadWrite');
    expect(m).toContain('offline_access');
    expect(m).not.toContain('https://graph.microsoft.com/Mail.Send');
  });

  it('buildAuthorizeUrl carries the purpose scopes', () => {
    const url = new URL(buildAuthorizeUrl('google', 'google.calendar.x', 'calendar'));
    expect(url.searchParams.get('scope')).toContain('calendar.events');
  });

  it('parseOAuthState reads provider and purpose', () => {
    expect(parseOAuthState('google.calendar.abc-123')).toEqual({
      provider: 'google',
      purpose: 'calendar',
    });
    expect(parseOAuthState('microsoft.email.abc-123')).toEqual({
      provider: 'microsoft',
      purpose: 'email',
    });
  });

  it('parseOAuthState treats legacy two-part states as email', () => {
    // In-flight consents started before this deploy have "<provider>.<uuid>".
    expect(parseOAuthState('google.abc-123')).toEqual({
      provider: 'google',
      purpose: 'email',
    });
  });

  it('parseOAuthState rejects garbage', () => {
    expect(parseOAuthState('evil.calendar.x')).toBeNull();
    expect(parseOAuthState('')).toBeNull();
  });

  it('isOAuthPurpose narrows', () => {
    expect(isOAuthPurpose('calendar')).toBe(true);
    expect(isOAuthPurpose('email')).toBe(true);
    expect(isOAuthPurpose('banana')).toBe(false);
  });
});
