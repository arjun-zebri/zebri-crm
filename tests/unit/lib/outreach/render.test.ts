import { describe, expect, it } from 'vitest';

import {
  countLinks, hasContactDetails, mergeValuesFor, OPT_OUT_LINE, renderTemplate, templateFields, withEmailFooter,
} from '@/lib/outreach/render';

describe('renderTemplate', () => {
  it('fills fields and fallbacks', () => {
    const r = renderTemplate('Hi {{ first_name }}, love your work in {{suburb|your area}}.', { first_name: 'Jane', suburb: null });
    expect(r).toEqual({ ok: true, text: 'Hi Jane, love your work in your area.' });
  });

  it('fails listing missing fields that have no fallback', () => {
    expect(renderTemplate('{{first_name}} {{first_name}} {{suburb}}', {})).toEqual({ ok: false, missing: ['first_name', 'suburb'] });
  });
});

describe('templateFields', () => {
  it('reports unknown fields', () => {
    expect(templateFields('{{first_name}} {{nickname|x}}')).toEqual({ fields: ['first_name', 'nickname'], unknown: ['nickname'] });
  });
});

describe('withEmailFooter', () => {
  it('appends the sender name, the business, the signature and the opt-out line, in that order', () => {
    expect(withEmailFooter('Hello\n\n', 'Jo Smith\n0400 000 000', 'Jo Smith')).toBe(
      `Hello\n\nJo Smith, Zebri\n\nJo Smith\n0400 000 000\n\n${OPT_OUT_LINE}`,
    );
  });

  it('always names the business even when no sender name is set', () => {
    const out = withEmailFooter('Hello', 'jo@example.com', '');
    expect(out.split('\n\n')[1]).toBe('Zebri');
  });

  it('never drops the opt-out line, even with an empty signature', () => {
    const out = withEmailFooter('Hello', ' ', 'Jo');
    expect(out.endsWith(OPT_OUT_LINE)).toBe(true);
    expect(out).toContain('Jo, Zebri');
  });

  it('keeps the opt-out wording plain and invites a reply', () => {
    expect(OPT_OUT_LINE).toBe("Not interested? Reply 'stop' and I won't contact you again.");
  });
});

describe('hasContactDetails', () => {
  it('accepts an email, a phone number or a web address', () => {
    expect(hasContactDetails('jo@example.com')).toBe(true);
    expect(hasContactDetails('Ph 0412 345 678')).toBe(true);
    expect(hasContactDetails('+61 412 345 678')).toBe(true);
    expect(hasContactDetails('www.example.com.au')).toBe(false);
    expect(hasContactDetails('https://example.com')).toBe(true);
  });

  it('rejects a bare name', () => {
    expect(hasContactDetails('Jo Smith, Celebrant')).toBe(false);
    expect(hasContactDetails('')).toBe(false);
  });
});

describe('renderTemplate merge-field safety', () => {
  it('treats inherited Object.prototype names as unknown fields, without throwing', () => {
    expect(renderTemplate('{{constructor}}', {})).toEqual({ ok: false, missing: ['constructor'] });
    expect(renderTemplate('{{__proto__|x}}', {})).toEqual({ ok: true, text: 'x' });
  });
});

describe('countLinks', () => {
  it('counts http links', () => {
    expect(countLinks('see https://a.com and http://b.com/x')).toBe(2);
  });
});

describe('mergeValuesFor', () => {
  it('tags the booking link and prefixes the handle', () => {
    const v = mergeValuesFor(
      { first_name: 'Jane', last_name: null, full_name: 'Jane', suburb: null, state: 'VIC', website: null, instagram_handle: 'jane', ref_code: 'abcd2345' },
      { bookingBaseUrl: 'https://app.zebri.com.au/book/t', senderName: 'Arjun' },
    );
    expect(v.booking_link).toBe('https://app.zebri.com.au/book/t?ref=abcd2345');
    expect(v.instagram_handle).toBe('@jane');
    expect(mergeValuesFor({ first_name: null, last_name: null, full_name: 'x', suburb: null, state: null, website: null, instagram_handle: null, ref_code: 'r' }, { bookingBaseUrl: null, senderName: '' }).booking_link).toBeNull();
  });
});
