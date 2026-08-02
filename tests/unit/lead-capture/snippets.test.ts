import { describe, expect, it } from 'vitest';

import {
  buildHostedUrl,
  buildIframeSnippet,
  buildScriptSnippet,
} from '@/lib/lead-capture/snippets';

const origin = 'https://app.zebri.com.au';
const token = '11111111-1111-4111-8111-111111111111';

describe('lead-capture snippets', () => {
  it('builds the hosted URL', () => {
    expect(buildHostedUrl(origin, token)).toBe(`${origin}/lead/${token}`);
  });
  it('iframe snippet points at the embed variant and is self-sizing', () => {
    const html = buildIframeSnippet(origin, token);
    expect(html).toContain(`src="${origin}/lead/${token}?embed=1"`);
    expect(html).toContain('<iframe');
  });
  it('script snippet references the loader and carries the token', () => {
    const html = buildScriptSnippet(origin, token);
    expect(html).toContain(`${origin}/lead-embed.js`);
    expect(html).toContain(`data-zebri-form="${token}"`);
  });
});
