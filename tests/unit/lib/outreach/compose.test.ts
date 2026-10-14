/**
 * Composing an email at send time: the footer goes on both parts, the
 * rich signature only on the HTML one, and a body queued with the old
 * baked-in footer is not given a second.
 */
import { describe, expect, it } from 'vitest';

import { identityLine, OPT_OUT_LINE, signatureLinesHtml, textToHtml, withEmailFooterHtml } from '@/lib/outreach/render';
import { composeEmail } from '@/lib/outreach/services/compose';

const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Jo Smith', marks: [{ type: 'bold' }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Website', marks: [{ type: 'link', attrs: { href: 'https://zebri.com.au' } }] }] },
    { type: 'image', attrs: { src: 'https://cdn.test/logo.png', alt: 'Zebri' } },
  ],
};
const settings = { sender_name: 'Jo', signature: 'Jo Smith\nWebsite <https://zebri.com.au>', signature_doc: doc };

describe('composeEmail', () => {
  it('puts the text signature on the text part and the rich one on the HTML part', () => {
    const out = composeEmail('Hi Jane,\n\nQuick question.', settings);
    // The signature names Jo and Zebri, so there is no separate identity line.
    expect(out.text).toBe(`Hi Jane,\n\nQuick question.\n\nJo Smith\nWebsite <https://zebri.com.au>\n\n${OPT_OUT_LINE}`);
    expect(out.html).toContain('<strong>Jo Smith</strong>');
    expect(out.html).toContain('href="https://zebri.com.au"');
    expect(out.html).toContain('src="https://cdn.test/logo.png"');
    expect(out.html).not.toContain('Jo, Zebri');
    expect(out.html).toContain("Reply &#39;stop&#39;");
  });

  it('builds the HTML signature from the text one when there is no document yet', () => {
    const out = composeEmail('Hi', { sender_name: 'Jo', signature: 'Jo\njo@example.com', signature_doc: null });
    expect(out.html).toContain('jo@example.com');
  });

  it('sends a body queued with the old footer as it stands', () => {
    const legacy = `Hi\n\nJo, Zebri\n\nJo\n\n${OPT_OUT_LINE}`;
    const out = composeEmail(legacy, settings);
    expect(out.text).toBe(legacy);
    expect(out.html.match(/Reply &#39;stop&#39;/g)).toHaveLength(1);
    expect(out.html).not.toContain('<strong>');
  });
});

describe('textToHtml', () => {
  it('writes Gmail-style lines, escapes markup and links URLs without trailing punctuation', () => {
    expect(textToHtml('Hi <Jane> & co,\n\nBook: https://zebri.com.au/b?ref=1.')).toBe(
      '<div>Hi &lt;Jane&gt; &amp; co,</div><div><br></div><div>Book: <a href="https://zebri.com.au/b?ref=1">https://zebri.com.au/b?ref=1</a>.</div>',
    );
  });
});

describe('withEmailFooterHtml', () => {
  it('leaves the signature block out when there is none', () => {
    const html = withEmailFooterHtml('Hi', '', '');
    expect(html).toBe(`<div dir="ltr"><div>Hi</div><div><br></div><div>Zebri</div><div><br></div><div>Not interested? Reply &#39;stop&#39; and I won&#39;t contact you again.</div></div>`);
  });
});

describe('signatureLinesHtml', () => {
  it('turns paragraphs into margin-free lines and keeps blank ones as one line', () => {
    // Gmail gives a bare <p> a full line of space either side, so the
    // signature arrived double-spaced next to the tight editor preview.
    expect(signatureLinesHtml('<p>Jo</p><p style="text-align:center"><strong>Founder</strong></p><p></p><img src="https://cdn.test/a.png" />')).toBe(
      '<div>Jo</div><div style="text-align:center"><strong>Founder</strong></div><div><br></div><img src="https://cdn.test/a.png" />',
    );
  });

  it('leaves tags that only start with p alone', () => {
    expect(signatureLinesHtml('<pre>x</pre>')).toBe('<pre>x</pre>');
  });
});

describe('composeEmail signature spacing', () => {
  it('sends no <p> in the HTML part', () => {
    const out = composeEmail('Hi', settings);
    expect(out.html).not.toMatch(/<p[\s>]/);
    expect(out.html).toContain('<div><strong>Jo Smith</strong></div>');
  });
});

describe('identityLine', () => {
  it('drops the line when the signature already names the sender and Zebri', () => {
    // The name printed twice in a row: "Arjun Punekar, Zebri" then the
    // signature's own "Arjun Punekar".
    expect(identityLine('Arjun Punekar', 'Arjun Punekar\nFounder\nwww.zebri.com.au')).toBeNull();
  });

  it('keeps it when the signature lacks the name or Zebri, so the sender is always named', () => {
    expect(identityLine('Arjun Punekar', 'Founder\nwww.zebri.com.au')).toBe('Arjun Punekar, Zebri');
    expect(identityLine('Arjun Punekar', 'Arjun Punekar\n0424 073 944')).toBe('Arjun Punekar, Zebri');
    expect(identityLine('', 'Zebri')).toBe('Zebri');
    expect(identityLine('Al', 'Weddings Australia\nzebri.com.au')).toBe('Al, Zebri');
  });
});

describe('composeEmail identity line', () => {
  it('names the sender once when the signature carries the name and Zebri', () => {
    const sig = { sender_name: 'Jo Smith', signature: 'Jo Smith\nhttps://zebri.com.au', signature_doc: null };
    const out = composeEmail('Hi', sig);
    expect(out.text).toBe(`Hi\n\nJo Smith\nhttps://zebri.com.au\n\n${OPT_OUT_LINE}`);
    expect(out.html).not.toContain('Jo Smith, Zebri');
    expect(out.html.match(/Jo Smith/g)).toHaveLength(1);
  });
});
