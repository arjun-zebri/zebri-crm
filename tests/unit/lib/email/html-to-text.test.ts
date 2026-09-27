/**
 * Unit tests for `htmlToText` (`lib/email/html-to-text`), the one place a
 * rendered email becomes its text/plain alternative (Task 31, audit M2).
 *
 * The property that matters most is the legal one: the text part has to
 * carry the same sender identity and unsubscribe URL as the HTML footer,
 * or a text-only reader has no way to opt out (Spam Act).
 */
import { describe, expect, it } from 'vitest';

import { appendComplianceFooter, wrapAutomationShell } from '@/lib/email/html';
import { htmlToText } from '@/lib/email/html-to-text';

describe('htmlToText', () => {
  it('turns paragraphs and line breaks into lines', () => {
    expect(htmlToText('<p>Hi Sarah,</p><p>Line one<br>Line two</p>')).toBe(
      'Hi Sarah,\n\nLine one\nLine two',
    );
  });

  it('writes a link as its label followed by the address', () => {
    expect(htmlToText('<p><a href="https://x.test/a?b=1&amp;c=2">Open it</a></p>')).toBe(
      'Open it (https://x.test/a?b=1&c=2)',
    );
  });

  it('writes a link whose label is its own address only once', () => {
    expect(htmlToText('<a href="https://x.test/a">https://x.test/a</a>')).toBe('https://x.test/a');
  });

  it('drops the head, styles and scripts', () => {
    const html =
      '<html><head><title>T</title><style>p{color:red}</style></head><body><script>x()</script><p>Body</p></body></html>';
    expect(htmlToText(html)).toBe('Body');
  });

  it('decodes entities, named and numeric', () => {
    expect(htmlToText('<p>Tom &amp; Jerry &middot; &lt;3 &#39;x&#39; &#x41;&nbsp;B</p>')).toBe(
      "Tom & Jerry · <3 'x' A B",
    );
  });

  it('bullets list items', () => {
    expect(htmlToText('<ul><li>One</li><li>Two</li></ul>')).toBe('- One\n- Two');
  });

  it('never leaves more than one blank line in a row', () => {
    expect(htmlToText('<div><p>A</p></div><div></div><div><p>B</p></div>')).toBe('A\n\nB');
  });

  it('carries the appended compliance footer: identity, details and the unsubscribe URL', () => {
    const url = 'https://app.zebri.com.au/unsubscribe/tok-123';
    const html = appendComplianceFooter(
      '<p>Hello</p>',
      'Alex MC',
      { abn: '12 345 678 901', phone: '0400 000 000', postal_address: '1 Main St' },
      url,
    );
    const text = htmlToText(html);
    expect(text).toContain('Hello');
    expect(text).toContain('Sent by Alex MC via Zebri');
    expect(text).toContain('ABN 12 345 678 901');
    expect(text).toContain('1 Main St');
    expect(text).toContain(`Unsubscribe (${url}) from these emails`);
  });

  it('carries the branded shell footer and its call to action', () => {
    const url = 'https://app.zebri.com.au/unsubscribe/tok-456';
    const html = wrapAutomationShell(
      'Hi there,\nSee you soon.',
      'Alex MC',
      { label: 'View your portal', url: 'https://app.zebri.com.au/portal/p1' },
      null,
      url,
    );
    const text = htmlToText(html);
    expect(text).toContain('Hi there,');
    expect(text).toContain('See you soon.');
    expect(text).toContain('https://app.zebri.com.au/portal/p1');
    expect(text).toContain(url);
    expect(text).toContain('Sent by Alex MC via Zebri');
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('reads the real href, not a data-href beside it', () => {
    expect(htmlToText('<a data-href="x" href="https://a.test">A</a>')).toBe('A (https://a.test)');
  });

  it('does not leak markup when an attribute value holds a >', () => {
    expect(htmlToText('<p title="a>b">Hi <a title="c>d" href="https://a.test">A</a></p>')).toBe(
      'Hi A (https://a.test)',
    );
  });

  it('decodes common named entities beyond the basics, and drops zero-width ones', () => {
    expect(htmlToText('<p>&euro;5 &eacute;t&eacute; caf&eacute;&zwnj;s &pound;2</p>')).toBe(
      '\u20ac5 \u00e9t\u00e9 caf\u00e9s \u00a32',
    );
  });

  it('numbers ordered list items', () => {
    expect(htmlToText('<ol><li>One</li><li>Two</li></ol><ul><li>Dot</li></ul>')).toBe(
      '1. One\n2. Two\n\n- Dot',
    );
  });

  it('collapses a source newline inside a paragraph to a space, as a browser does', () => {
    expect(htmlToText('<p>one\n   two</p>')).toBe('one two');
  });
});
