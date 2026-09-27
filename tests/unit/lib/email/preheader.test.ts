/**
 * Tests for the Task 32 preheader: the hidden inbox-preview sentence every
 * couple-facing shell emits as the first thing inside `<body>`.
 *
 * Layers covered:
 * - `derivePreheaderText`: the pure truncation algorithm (word boundary,
 *   the ~90-110 char window, short/empty bodies, grapheme-safe hard cuts).
 * - `preheaderHtml`: the markup itself (marker attribute, escaping, the
 *   empty-input no-op, padding length).
 * - `autoPreheaderHtml`: the one derive-and-render helper every shell
 *   calls, including its URL scrub and its HTML-vs-plain-text split.
 * - The shells and builders that wire it in, `contractOtpHtml`'s fixed
 *   code-free preheader, and `htmlToText`'s job of stripping the hidden
 *   element back out so the text/plain alternative never repeats it.
 *
 * Fix round 1 (Task 32 review): I1 (contractOtpHtml gets a fixed,
 * code-free preheader instead of none), I2 (URLs scrubbed before
 * truncation), M1 (padding long enough to stop snippet bleed), M3
 * (grapheme-safe hard cut), M4 (behaviour-asserting tests, more paths
 * covered), M5 (one `autoPreheaderHtml` helper). The Phase 5 fix wave
 * closed the two parked items: M2 (a literal `<` in a rendered body is
 * kept, not eaten as a tag) and the schemeless bare-domain link.
 *
 * @module tests/unit/lib/email/preheader
 */
import { describe, expect, it } from 'vitest';

import { buildPublicBranding } from '@/lib/branding/public-branding';
import {
  autoPreheaderHtml,
  contractHtml,
  contractOtpHtml,
  contractSignedHtml,
  derivePreheaderText,
  invoiceHtml,
  PREHEADER_MARKER_ATTR,
  preheaderHtml,
  questionnaireHtml,
  wrapAutomationShell,
  wrapTemplateHtml,
} from '@/lib/email/html';
import { htmlToText } from '@/lib/email/html-to-text';

/**
 * Approximates the text an inbox client's preview-snippet reader would
 * see: unlike `htmlToText` (which deliberately drops the hidden preheader
 * so the text/plain part never repeats it), a client's snippet reader
 * DOES read hidden text, which is the entire point of the preheader
 * trick. Tags are stripped and the entities the shell actually emits are
 * decoded to their real (often invisible) characters; nothing is
 * collapsed, since a client does not re-flow hidden padding away before
 * it counts characters for its snippet.
 */
function visiblePreviewText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&zwnj;/g, '‌')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** The text content of the hidden preheader element, or undefined if none. */
function preheaderContent(html: string): string | undefined {
  return /data-zb-preheader="true"[^>]*>([^<]*)</.exec(html)?.[1];
}

describe('derivePreheaderText', () => {
  it('returns a short body untouched', () => {
    expect(derivePreheaderText('Hi Sarah, thanks for booking with us.')).toBe(
      'Hi Sarah, thanks for booking with us.',
    );
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(derivePreheaderText('')).toBe('');
    expect(derivePreheaderText('   \n  ')).toBe('');
  });

  it('cuts a long body at a word boundary inside the 90-110 char window', () => {
    // Every word is 5 chars ("word0".."word9" then "word10"+), so the
    // window boundary always lands on a space, never mid-word.
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`);
    const body = words.join(' ');
    expect(body.length).toBeGreaterThan(110);

    const result = derivePreheaderText(body);
    expect(result.length).toBeLessThanOrEqual(110);
    expect(result.length).toBeGreaterThanOrEqual(90);
    // The cut is a real word boundary: the whole body starts with it, and
    // the character right after it (if any) was a space in the source.
    expect(body.startsWith(result)).toBe(true);
    expect(body[result.length]).toBe(' ');
    // No trailing space left dangling on the cut itself.
    expect(result.endsWith(' ')).toBe(false);
  });

  it('hard-cuts at 110 when there is no space to break on', () => {
    const body = 'x'.repeat(200);
    const result = derivePreheaderText(body);
    expect(result).toBe('x'.repeat(110));
  });

  // Task 32 review M3: a hard cut on raw UTF-16 code units can land
  // inside a surrogate pair, producing a lone surrogate that renders as
  // U+FFFD in the preview instead of the emoji being left out cleanly.
  it('never splits a surrogate pair on a hard cut', () => {
    // A leading single-unit char plus many 2-unit emoji, with no spaces
    // anywhere: the naive code-unit cut at 110 lands mid-pair here (110
    // is even, but the leading "a" shifts every pair boundary by one).
    const body = 'a' + '\u{1F600}'.repeat(80);
    const result = derivePreheaderText(body);

    // No dangling (unpaired) surrogate at either edge.
    expect(result).not.toMatch(/[\uD800-\uDBFF]$/);
    expect(result).not.toMatch(/^[\uDC00-\uDFFF]/);
    expect(result.length).toBeLessThanOrEqual(110);
    // Backing off a surrogate pair may cut one unit short of the cap;
    // it should never cut drastically short.
    expect(result.length).toBeGreaterThanOrEqual(108);
  });
});

describe('preheaderHtml', () => {
  it('renders nothing for empty text', () => {
    expect(preheaderHtml('')).toBe('');
  });

  it('carries the marker attribute and the text', () => {
    const html = preheaderHtml('Thanks for booking with us');
    expect(html).toContain(`${PREHEADER_MARKER_ATTR}="true"`);
    expect(html).toContain('Thanks for booking with us');
    expect(html).toContain('display:none');
  });

  it('escapes markup in the text', () => {
    const html = preheaderHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  // Task 32 review M1: 16 pairs (32 invisible characters) let a short
  // body's snippet bleed into whatever visible text follows (the CTA
  // button, the branding header, the footer). The review's own guidance
  // is "roughly 100 or more".
  it('pads with at least 100 invisible characters after the text', () => {
    const html = preheaderHtml('x');
    const match = /data-zb-preheader="true"[^>]*>x([\s\S]*?)<\/div>/.exec(html);
    expect(match).toBeTruthy();
    const decodedPadding = (match?.[1] ?? '').replace(/&zwnj;/g, '‌').replace(/&nbsp;/g, ' ');
    expect(decodedPadding.length).toBeGreaterThanOrEqual(100);
  });
});

describe('autoPreheaderHtml: the one derive-and-render helper (Task 32 review M5)', () => {
  it('drives the full pipeline for an HTML source', () => {
    const html = autoPreheaderHtml('<p>Hello there, thanks for reaching out.</p>');
    expect(html).toContain(PREHEADER_MARKER_ATTR);
    expect(html).toContain('Hello there, thanks for reaching out.');
  });

  it('does not run the HTML tag-stripper on a plain-text source', () => {
    // A plain-text automation body can legitimately contain a bare
    // `<`/`>` (e.g. "if x < y"). Running the HTML tag-stripper on it
    // would eat real words as if they were a tag (the M2 failure mode,
    // parked for markup sources, but a plain-text source must never gain
    // it in the first place).
    const html = autoPreheaderHtml('Hi Jess, if x < y then we proceed.', false);
    // Escaped (correctly: this text-node content still displays as
    // "if x < y"), not eaten as if "< y then we proceed." were a tag.
    expect(preheaderContent(html)).toContain('if x &lt; y then we proceed.');
  });

  it('scrubs a bare URL from either source type', () => {
    const fromHtml = autoPreheaderHtml('<p>Link: <a href="https://x.test/secret">https://x.test/secret</a></p>');
    expect(fromHtml).not.toContain('secret');
    expect(fromHtml).not.toContain('https://');

    const fromText = autoPreheaderHtml('Link: https://x.test/secret', false);
    expect(fromText).not.toContain('secret');
    expect(fromText).not.toContain('https://');
  });

  it('scrubs a schemeless link to a path, token and all (Phase 5 parked, T32 I2)', () => {
    const html = autoPreheaderHtml('<p>Your portal: zebri.com.au/portal/SECRETTOKEN0123456789abcdef see you soon</p>');
    expect(html).not.toContain('SECRETTOKEN');
    expect(html).not.toContain('zebri.com.au/portal');
    expect(preheaderContent(html)).toContain('Your portal: see you soon');
  });

  it('keeps ordinary prose with dots in it', () => {
    const html = autoPreheaderHtml('<p>See you at 5.30pm, e.g. after the speeches. The venue is Gunners.</p>');
    expect(preheaderContent(html)).toContain('See you at 5.30pm, e.g. after the speeches. The venue is Gunners.');
  });

  it('keeps a literal < in a rendered body instead of eating the words after it (T32 M2)', () => {
    // A couple name like "Tom <3 Jo" is interpolated raw into several
    // shells; the browser shows it as text, so the preheader must too.
    const html = autoPreheaderHtml('<p>Hi Tom <3 Jo, your invoice is ready.</p>');
    expect(preheaderContent(html)).toContain('Hi Tom &lt;3 Jo, your invoice is ready.');
  });

  it('renders nothing when the source has no derivable text', () => {
    expect(autoPreheaderHtml('<img src="https://x.test/a.png">')).toBe('');
    expect(autoPreheaderHtml('   ', false)).toBe('');
  });
});

describe('wrapAutomationShell preheader', () => {
  it('emits the preheader as the first hidden element, derived from the body', () => {
    const html = wrapAutomationShell('Hi Sarah,\nThanks for booking with us.', 'Acme MC');
    const markerAt = html.indexOf(PREHEADER_MARKER_ATTR);
    const bodyAt = html.indexOf('<body');
    const visibleContentAt = html.indexOf('Thanks for booking with us.', bodyAt + 1);
    expect(markerAt).toBeGreaterThan(bodyAt);
    // The preheader (hidden) comes before the visible copy of the body.
    expect(markerAt).toBeLessThan(visibleContentAt);
    expect(html).toContain('Hi Sarah, Thanks for booking with us.');
  });

  it('carries the couple\'s real, resolved name (never a raw {{token}})', () => {
    const html = wrapAutomationShell('Hi Jess & Sam, see you at the venue.', 'Acme MC');
    expect(preheaderContent(html)).toContain('Jess &amp; Sam');
  });

  it('stays safe when the body is empty', () => {
    const html = wrapAutomationShell('', 'Acme MC');
    // No preheader element at all, rather than an empty hidden one.
    expect(html).not.toContain(PREHEADER_MARKER_ATTR);
  });

  it('does not repeat the branding header or the sender footer', () => {
    const branding = buildPublicBranding({ business_name: 'Acme MC Co' });
    const html = wrapAutomationShell('A short note.', 'Acme MC Co', undefined, branding);
    const content = preheaderContent(html);
    expect(content).toBeTruthy();
    expect(content).not.toContain('Sent by');
    expect(content).not.toContain('via Zebri');
  });

  // Task 32 review I2.
  it('drops a bare URL a resolved link variable left in the plain-text body', () => {
    const html = wrapAutomationShell(
      'Your portal: https://app.zebri.com.au/portal/SECRETTOKEN0123456789abcdef see you soon',
      'Acme MC',
    );
    const content = preheaderContent(html);
    expect(content).not.toContain('SECRETTOKEN');
    expect(content).not.toContain('https://');
    expect(content).toContain('Your portal:');
    expect(content).toContain('see you soon');
  });

  it('never emits a partial token URL, even when the only space in range is before the minimum', () => {
    const body = `Hi Anna, https://app.zebri.com.au/portal/${'x'.repeat(150)}`;
    const html = wrapAutomationShell(body, 'Acme MC');
    const content = preheaderContent(html) ?? '';
    expect(content).not.toContain('https://');
    expect(content).not.toMatch(/x{5,}/);
  });

  // Task 32 review M1.
  it('pushes a short body\'s CTA link and label well past the hidden element', () => {
    const html = wrapAutomationShell("Here's the run sheet for Anna & Jake.", 'Acme MC', {
      label: 'Open the run sheet',
      url: 'https://app.zebri.com.au/share/SECRETTOKEN',
    });
    const bodyAt = html.indexOf('<body');
    const preheaderStart = html.indexOf('data-zb-preheader', bodyAt);
    const preheaderClose = html.indexOf('</div>', preheaderStart);
    const ctaAt = html.indexOf('Open the run sheet', bodyAt);
    // The CTA text only ever appears after the hidden element has closed.
    expect(ctaAt).toBeGreaterThan(preheaderClose);
    // And the hidden element itself is well past a 150-char budget, so a
    // client reading past the visible preheader sentence for its own
    // snippet still has that much invisible text ahead of the CTA.
    expect(preheaderClose - preheaderStart).toBeGreaterThan(150);
  });
});

describe('wrapTemplateHtml preheader', () => {
  it('derives the preheader from bodyHtml, tags stripped', () => {
    const html = wrapTemplateHtml('<p>Hello there, thanks for reaching out.</p>', 'Acme MC Co');
    expect(html).toContain(`${PREHEADER_MARKER_ATTR}="true"`);
    expect(html).toContain('Hello there, thanks for reaching out.');
  });

  it('excludes the footer text from the derived preheader', () => {
    const content = preheaderContent(wrapTemplateHtml('<p>Short body.</p>', 'Acme MC Co'));
    expect(content).not.toContain('Sent by');
  });

  it('stays safe when the body has no derivable text', () => {
    const html = wrapTemplateHtml('<img src="https://x.test/a.png">', 'Acme MC Co');
    expect(html).not.toContain(PREHEADER_MARKER_ATTR);
  });

  it('is present in the neutral shell fallback used by invoiceHtml with no branding', () => {
    const html = invoiceHtml({
      coupleName: 'Anna & Jake',
      invoiceNumber: 'INV-1',
      invoiceTitle: 'Deposit',
      dueDate: null,
      shareUrl: 'https://app.example/invoice/1',
      mcBusinessName: 'Sam MC',
    });
    expect(html).toContain(PREHEADER_MARKER_ATTR);
  });

  // Task 32 review I2: an anchor whose visible label is itself the URL
  // (a pasted link, rather than a labelled button) must not reach the
  // preheader either.
  it('drops a URL used as its own anchor label', () => {
    const html = wrapTemplateHtml(
      '<p>Hi, your link <a href="https://app.zebri.com.au/portal/SECRETTOKEN">https://app.zebri.com.au/portal/SECRETTOKEN</a></p>',
      'Acme MC Co',
    );
    const content = preheaderContent(html) ?? '';
    expect(content).not.toContain('SECRETTOKEN');
    expect(content).not.toContain('https://');
  });

  // Task 32 review M4: the branding header, not just the visible body,
  // must sit strictly after the hidden element closes.
  it('the preheader precedes the branding header (wordmark), not just the body', () => {
    const branding = buildPublicBranding({ business_name: 'Acme MC Co' });
    const html = wrapTemplateHtml('<p>Hello there.</p>', 'Acme MC Co', branding);
    const preheaderAt = html.indexOf(PREHEADER_MARKER_ATTR);
    const preheaderClose = html.indexOf('</div>', preheaderAt);
    const headerAt = html.indexOf('Acme MC Co', preheaderClose);
    expect(preheaderAt).toBeGreaterThan(-1);
    expect(headerAt).toBeGreaterThan(preheaderClose);
  });
});

describe('questionnaireHtml and contractHtml preheader, branded and unbranded', () => {
  const questionnaireOpts = {
    coupleName: 'Anna & Jake',
    title: 'A few questions',
    shareUrl: 'https://app.example/q/1',
    mcBusinessName: 'Sam MC',
  };
  const contractOpts = {
    coupleName: 'Anna & Jake',
    contractNumber: 'CN-1',
    contractTitle: 'Wedding MC Agreement',
    expiresAt: null,
    shareUrl: 'https://app.example/contract/1',
    mcBusinessName: 'Sam MC',
  };

  it('questionnaireHtml carries a preheader without branding', () => {
    expect(questionnaireHtml(questionnaireOpts)).toContain(PREHEADER_MARKER_ATTR);
  });

  // Task 32 review M4: only the unbranded path had a test.
  it('questionnaireHtml carries a preheader when branded too', () => {
    const branding = buildPublicBranding({ business_name: 'Sam MC' });
    expect(questionnaireHtml(questionnaireOpts, branding)).toContain(PREHEADER_MARKER_ATTR);
  });

  it('contractHtml carries a preheader without branding', () => {
    expect(contractHtml(contractOpts)).toContain(PREHEADER_MARKER_ATTR);
  });

  it('contractHtml carries a preheader when branded too', () => {
    const branding = buildPublicBranding({ business_name: 'Sam MC' });
    expect(contractHtml(contractOpts, branding)).toContain(PREHEADER_MARKER_ATTR);
  });

  it('contractSignedHtml carries a preheader without branding', () => {
    const html = contractSignedHtml({
      recipientName: 'Anna',
      contractNumber: 'CN-1',
      contractTitle: 'Wedding MC Agreement',
      signerNames: ['Anna', 'Jake'],
      signedAt: null,
      shareUrl: 'https://app.example/contract/1',
      mcBusinessName: 'Sam MC',
    });
    expect(html).toContain(PREHEADER_MARKER_ATTR);
  });

  // Task 32 review: the branded and unbranded paths must keep showing the
  // same copy (the hoist that lets both derive from one `bodyHtml` is a
  // pure reorg, not a content change).
  it('questionnaireHtml shows the same body copy whether branded or not', () => {
    const branding = buildPublicBranding({ business_name: 'Sam MC' });
    for (const html of [questionnaireHtml(questionnaireOpts), questionnaireHtml(questionnaireOpts, branding)]) {
      expect(html).toContain('Start questionnaire');
      expect(html).toContain('would love a few details to help plan your day');
    }
  });

  it('contractHtml shows the same body copy whether branded or not', () => {
    const branding = buildPublicBranding({ business_name: 'Sam MC' });
    for (const html of [contractHtml(contractOpts), contractHtml(contractOpts, branding)]) {
      expect(html).toContain('has sent you a contract to review and sign');
      expect(html).toContain('Review &amp; Sign Contract');
    }
  });
});

describe('contractOtpHtml: fixed, code-free preheader (Task 32 review I1)', () => {
  const opts = {
    recipientName: 'Anna',
    code: '123456',
    contractNumber: 'CN-1',
    mcBusinessName: 'Sam MC',
    minutes: 10,
  };

  it('renders a fixed, code-free preheader on the unbranded path', () => {
    const html = contractOtpHtml(opts);
    const content = preheaderContent(html);
    expect(content).toBeTruthy();
    expect(content).not.toContain('123456');
    expect(content).toContain('signing code');
    expect(content).toContain('CN-1');
    expect(content).toContain('10 minutes');
  });

  it('renders the same fixed, code-free preheader on the branded path', () => {
    const branding = buildPublicBranding({ business_name: 'Sam MC' });
    const html = contractOtpHtml(opts, branding);
    const content = preheaderContent(html);
    expect(content).toBeTruthy();
    expect(content).not.toContain('123456');
    expect(content).toContain('signing code');
  });

  it('never puts the code in the first ~200 characters of visible preview text (unbranded)', () => {
    const preview = visiblePreviewText(contractOtpHtml(opts)).slice(0, 200);
    expect(preview).not.toContain('123456');
  });

  it('never puts the code in the first ~200 characters of visible preview text (branded)', () => {
    const branding = buildPublicBranding({ business_name: 'Sam MC' });
    const preview = visiblePreviewText(contractOtpHtml(opts, branding)).slice(0, 200);
    expect(preview).not.toContain('123456');
  });

  it('the code is still in the body, just not the preheader', () => {
    expect(contractOtpHtml(opts)).toContain('123456');
  });
});

describe('htmlToText strips the preheader', () => {
  it('drops the hidden preheader and its padding, no duplicate sentence', () => {
    const html = wrapAutomationShell('Hi Sarah, thanks for booking with us.', 'Acme MC');
    const text = htmlToText(html);
    const occurrences = text.split('thanks for booking with us').length - 1;
    expect(occurrences).toBe(1);
    expect(text).not.toContain('‌'); // decoded &zwnj;
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('drops the preheader from the branded shell too', () => {
    const html = wrapTemplateHtml('<p>Hello there, thanks for reaching out.</p>', 'Acme MC Co');
    const text = htmlToText(html);
    const occurrences = text.split('Hello there, thanks for reaching out').length - 1;
    expect(occurrences).toBe(1);
  });

  it('leaves no zero-width padding junk when the body is short', () => {
    const html = wrapAutomationShell('Short note.', 'Acme MC');
    const text = htmlToText(html);
    expect(text.startsWith('Short note.')).toBe(true);
  });

  it('strips contractOtpHtml\'s fixed preheader too, leaving the code intact once', () => {
    const html = contractOtpHtml({
      recipientName: 'Anna',
      code: '123456',
      contractNumber: 'CN-1',
      mcBusinessName: 'Sam MC',
      minutes: 10,
    });
    const text = htmlToText(html);
    expect(text.split('123456').length - 1).toBe(1);
    expect(text).not.toContain('signing code for contract');
  });
});
