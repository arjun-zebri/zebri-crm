import { describe, expect, it } from 'vitest';

import { buildDraftPrompt, parseDraft } from '@/lib/workflows/ai-draft';

describe('buildDraftPrompt', () => {
  const base = {
    instruction: 'Warmer please',
    subject: 'Your run sheet',
    body: 'Hi {{couple.primary_name}}, here it is.',
    stepTitle: 'Two week check-in',
  };

  it('carries the message, the instruction and the couple', () => {
    const out = buildDraftPrompt({
      ...base,
      coupleName: 'Sam and Alex',
      weddingDate: '2027-02-14',
      senderName: 'Jo',
    });
    expect(out).toContain('Warmer please');
    expect(out).toContain('Your run sheet');
    expect(out).toContain('{{couple.primary_name}}');
    expect(out).toContain('Sam and Alex');
    expect(out).toContain('2027-02-14');
    expect(out).toContain('Jo');
  });

  it('drops context lines it does not have', () => {
    // A personal workflow has no couple. An empty "Couple:" line would
    // invite the model to invent one.
    const out = buildDraftPrompt(base);
    expect(out).not.toContain('Couple:');
    expect(out).not.toContain('Wedding date:');
  });
});

describe('parseDraft', () => {
  const fallback = { subject: 'Old subject', body: 'Old body' };

  it('splits the formatted reply', () => {
    const out = parseDraft('SUBJECT: New subject\nBODY:\nLine one\n\nLine two', fallback);
    expect(out).toEqual({ subject: 'New subject', body: 'Line one\n\nLine two' });
  });

  it('keeps what was on screen when the model returns nothing usable', () => {
    // A blank reply must not blank the MC's email.
    expect(parseDraft('   ', fallback)).toEqual(fallback);
  });

  it('treats an unformatted reply as the body and keeps the subject', () => {
    const out = parseDraft('Just the rewritten message.', fallback);
    expect(out).toEqual({ subject: 'Old subject', body: 'Just the rewritten message.' });
  });

  it('takes the text after a lone subject line as the body', () => {
    const out = parseDraft('SUBJECT: Fresh\nThe message itself.', fallback);
    expect(out).toEqual({ subject: 'Fresh', body: 'The message itself.' });
  });

  it('does not swallow a BODY word that is part of the message', () => {
    const out = parseDraft(
      'SUBJECT: Fresh\nBODY:\nThe BODY: of the ceremony is set.',
      fallback,
    );
    expect(out.body).toBe('The BODY: of the ceremony is set.');
  });
});
