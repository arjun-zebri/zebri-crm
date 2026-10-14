/**
 * The rich outreach signature's plain-text copy, and the conversion of a
 * signature saved before the rich editor.
 */
import { describe, expect, it } from 'vitest';

import { hasContactDetails } from '@/lib/outreach/render';
import { signatureDocToText, textToSignatureDoc } from '@/lib/outreach/signature';

const p = (...content: object[]) => ({ type: 'paragraph', content });
const text = (t: string, marks?: object[]) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const link = (href: string) => [{ type: 'link', attrs: { href } }];

describe('signatureDocToText', () => {
  it('writes one line per paragraph and drops bold', () => {
    const doc = { type: 'doc', content: [p(text('Jo Smith', [{ type: 'bold' }])), p(text('Celebrant, Zebri'))] };
    expect(signatureDocToText(doc)).toBe('Jo Smith\nCelebrant, Zebri');
  });

  it('keeps a link address behind its label, so contact details survive', () => {
    const doc = {
      type: 'doc',
      content: [
        p(text('Website', link('https://zebri.com.au'))),
        p(text('Call me', link('tel:0412345678'))),
        p(text('jo@zebri.com.au', link('mailto:jo@zebri.com.au'))),
      ],
    };
    const out = signatureDocToText(doc);
    expect(out).toBe('Website <https://zebri.com.au>\nCall me <0412345678>\njo@zebri.com.au');
    expect(hasContactDetails(out)).toBe(true);
  });

  it('leaves images out, keeps hard breaks and list items as lines', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'https://x.test/logo.png' } },
        p(text('Jo'), { type: 'hardBreak' }, text('0400 000 000')),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('One'))] }, { type: 'listItem', content: [p(text('Two'))] }] },
      ],
    };
    expect(signatureDocToText(doc)).toBe('Jo\n0400 000 000\nOne\nTwo');
  });

  it('is empty for an empty or missing document', () => {
    expect(signatureDocToText(null)).toBe('');
    expect(signatureDocToText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
  });
});

describe('textToSignatureDoc', () => {
  it('makes one paragraph per line and round-trips through the text copy', () => {
    const doc = textToSignatureDoc('Jo Smith\n\njo@example.com');
    expect(doc.content).toHaveLength(3);
    expect(signatureDocToText(doc)).toBe('Jo Smith\n\njo@example.com');
  });

  it('gives an empty signature a single empty paragraph', () => {
    expect(textToSignatureDoc('  ')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});
