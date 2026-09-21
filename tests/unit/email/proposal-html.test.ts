/**
 * Tests for {@link proposalHtml}.
 *
 * @module tests/unit/email/proposal-html
 */
import { describe, expect, it } from 'vitest';

import { proposalAcceptedHtml, proposalDeclinedHtml, proposalHtml, proposalOpenedHtml } from '@/lib/email/html';

describe('proposalHtml', () => {
  const opts = {
    coupleName: 'Anna & Jake',
    proposalNumber: 'PR-001',
    proposalTitle: 'Your wedding with Sam',
    expiresAt: '31 January 2027',
    shareUrl: 'https://app.example/proposal/abc',
    mcBusinessName: 'Sam MC',
  };

  it('links to the proposal and names the sender', () => {
    const html = proposalHtml(opts);
    expect(html).toContain('href="https://app.example/proposal/abc"');
    expect(html).toContain('View proposal');
    expect(html).toContain('Sam MC');
    // invoiceHtml does not HTML-escape names in the unbranded path, and
    // proposalHtml matches that behaviour for consistency.
    expect(html).toContain('Anna & Jake');
    expect(html).toContain('31 January 2027');
  });

  it('omits the expiry line when there is none', () => {
    expect(proposalHtml({ ...opts, expiresAt: null })).not.toContain('Valid until');
  });
});

describe('proposalAcceptedHtml', () => {
  const opts = {
    coupleName: 'Anna <script>alert(1)</script> & Jake',
    proposalNumber: 'PR-001',
    proposalTitle: 'Your <b>wedding</b>',
    packageName: 'Full <i>day</i>',
    total: 1400,
    invoiceNumber: 'INV-014',
    detailUrl: 'https://app.example/proposals/1',
    mcBusinessName: 'Sam MC',
  };

  it('escapes every free-text field and names the signed contract and the invoice', () => {
    const html = proposalAcceptedHtml(opts);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Anna &lt;script&gt;');
    expect(html).toContain('Full &lt;i&gt;day&lt;/i&gt;');
    expect(html).toContain('Your &lt;b&gt;wedding&lt;/b&gt;');
    expect(html).toContain('signed the contract');
    expect(html).toContain('Invoice INV-014 has been generated');
    expect(html).not.toContain('ready for their signature');
  });
});

describe('proposalDeclinedHtml', () => {
  it('escapes the names and the reason label as well as the message', () => {
    const html = proposalDeclinedHtml({
      coupleName: 'Anna <img src=x>',
      proposalNumber: 'PR-002',
      proposalTitle: 'Title <u>x</u>',
      reasonLabel: 'Price <b>',
      message: 'Too <dear>',
      detailUrl: 'https://app.example/proposals/2',
      mcBusinessName: 'Sam MC',
    });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<u>');
    expect(html).toContain('Price &lt;b&gt;');
    expect(html).toContain('Too &lt;dear&gt;');
  });
});

describe('proposalOpenedHtml', () => {
  it('escapes every free-text field and names the first open', () => {
    const html = proposalOpenedHtml({
      coupleName: 'Anna <script>alert(1)</script> & Jake',
      proposalNumber: 'PR-003',
      proposalTitle: 'Your <b>wedding</b>',
      detailUrl: 'https://app.example/proposals/3',
      mcBusinessName: 'Sam MC',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('Anna &lt;script&gt;');
    expect(html).toContain('Your &lt;b&gt;wedding&lt;/b&gt;');
    expect(html).toContain('just opened your proposal');
    expect(html).toContain('href="https://app.example/proposals/3"');
    expect(html).toContain('Open in Zebri');
  });
});
