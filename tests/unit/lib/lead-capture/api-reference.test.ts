/**
 * The API reference text must stay in step with the real contract.
 *
 * @module tests/unit/lib/lead-capture/api-reference
 */
import { describe, expect, it } from 'vitest';

import {
  buildExampleHtml,
  buildLlmsTxt,
  LEAD_API_ERRORS,
  LEAD_PAYLOAD_KEYS,
  MIN_FILL_SECONDS,
} from '@/lib/lead-capture/api-reference';

const origin = 'https://app.zebri.com.au';
const token = '11111111-1111-4111-8111-111111111111';

describe('reference data', () => {
  it('lists every error code and status once', () => {
    expect(LEAD_API_ERRORS.map((e) => `${e.status} ${e.code}`)).toEqual([
      '200 ok',
      '400 validation_failed',
      '403 origin_not_allowed',
      '404 form_not_found',
      '409 form_disabled',
      '429 rate_limited',
      '500 server_error',
    ]);
    expect(LEAD_PAYLOAD_KEYS.map((k) => k.key)).toEqual([
      'token', 'name', 'partner_name', 'email', 'phone', 'wedding_date', 'venue', 'referral_source', 'message', 'custom', 'hp', 'rendered_at',
    ]);
    expect(MIN_FILL_SECONDS).toBe(2);
  });
});

describe('buildLlmsTxt / buildExampleHtml', () => {
  it('llms.txt covers both endpoints, the payload keys and every error', () => {
    const txt = buildLlmsTxt(origin);
    expect(txt).toContain(`${origin}/api/lead/config?token=`);
    expect(txt).toContain(`${origin}/api/lead/submit`);
    for (const k of LEAD_PAYLOAD_KEYS) expect(txt).toContain(k.key);
    for (const e of LEAD_API_ERRORS) expect(txt).toContain(e.code);
    expect(txt).not.toContain('—');
  });

  it('the HTML example posts the token with hp and rendered_at', () => {
    const html = buildExampleHtml(origin, token);
    expect(html).toContain(`${origin}/api/lead/submit`);
    expect(html).toContain(token);
    expect(html).toContain('rendered_at');
    expect(html).toContain('company_website');
  });
});
