/**
 * Email-preview decoration tests.
 *
 * The preview renders the real email templates inside a sandboxed
 * iframe. Two things have to hold:
 * - a saved document's CTA opens in a new tab rather than navigating
 *   the iframe (which the sandbox blocks, showing "refused to connect");
 * - an unsaved document has no share link, so nothing may be clickable.
 *
 * @module tests/unit/components/builders/parts/preview-email.test
 */
import { describe, it, expect } from 'vitest';

import { decorateEmailPreview } from '@/components/builders/parts/preview-email';
import { invoiceHtml } from '@/lib/email/html';

const render = (shareUrl: string) =>
  invoiceHtml({
    coupleName: 'Test',
    invoiceNumber: 'INV-001',
    invoiceTitle: 'Wedding Invoice',
    dueDate: null,
    shareUrl,
    mcBusinessName: 'Your MC',
  });

describe('decorateEmailPreview', () => {
  it('targets links at a new tab so the iframe is never navigated', () => {
    const html = decorateEmailPreview(render('https://app.test/invoice/tok'), 'https://app.test/invoice/tok');
    expect(html).toContain('<base target="_blank">');
    expect(html).toContain('href="https://app.test/invoice/tok"');
  });

  it('strips every href when the document has no share link yet', () => {
    const html = decorateEmailPreview(render('link created when you send'), null);
    expect(html).not.toContain('href=');
    // The CTA and copy-link text survive — only the navigation goes.
    expect(html).toContain('View Invoice');
  });

  it('never leaves a placeholder domain in the preview', () => {
    const html = decorateEmailPreview(render('link created when you send'), null);
    expect(html).not.toContain('example.com');
  });
});
