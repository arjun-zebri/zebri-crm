/**
 * Composing an email at send time: the footer goes on both parts, the
 * rich signature only on the HTML one, and a body queued with the old
 * baked-in footer is not given a second.
 */
import { describe, expect, it } from 'vitest';

import { OPT_OUT_LINE, textToHtml, withEmailFooterHtml } from '@/lib/outreach/render';
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
    expect(out.text).toBe(`Hi Jane,\n\nQuick question.\n\nJo, Zebri\n\nJo Smith\nWebsite <https://zebri.com.au>\n\n${OPT_OUT_LINE}`);
    expect(out.html).toContain('<strong>Jo Smith</strong>');
    expect(out.html).toContain('href="https://zebri.com.au"');
    expect(out.html).toContain('src="https://cdn.test/logo.png"');
    expect(out.html).toContain('Jo, Zebri');
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
