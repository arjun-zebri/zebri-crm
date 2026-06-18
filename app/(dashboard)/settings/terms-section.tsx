/**
 * Inline Zebri Terms of Service rendered inside the Settings modal.
 * Copy mirrors zebri.com.au/terms (canonical).
 *
 * @module app/(dashboard)/settings/terms-section
 */
'use client';

import { LegalSection } from './legal-section';

export function TermsSection() {
  return (
    <LegalSection title="Terms of Service" lastUpdated="10 March 2026" canonicalUrl="https://www.zebri.com.au/terms">
      <p>
        These Terms of Service are a legally binding agreement between you and Knotify
        Pty Ltd trading as Zebri. By using the platform you agree to them.
      </p>

      <h3>1. Accounts</h3>
      <p>
        You must be 18 or older, provide accurate information, and keep your password
        secure. Holding more than one account requires our written consent.
      </p>

      <h3>2. Subscriptions &amp; billing</h3>
      <p>
        Free, Pro, and Max plans are available with a 14-day free trial. Pricing is in
        AUD and includes GST. Monthly subscriptions are non-refundable; annual
        subscriptions are fully refundable within 14 days if minimally used.
      </p>

      <h3>3. Cancellation</h3>
      <p>
        You may cancel at any time; access continues through the current billing
        period. Your content remains accessible for 30 days after cancellation so you
        can export it.
      </p>

      <h3>4. Acceptable use</h3>
      <p>You may not reverse engineer the platform, scrape data, exceed the scope of the Free plan, upload illegal content, or store sensitive financial or health records beyond what wedding management requires.</p>

      <h3>5. Content ownership</h3>
      <p>You retain full ownership of all content you create or upload.</p>

      <h3>6. Liability</h3>
      <p>
        Our maximum liability is limited to the fees you paid in the preceding 12
        months or AUD $100, whichever is greater. We are not liable for indirect or
        consequential damages.
      </p>

      <h3>7. Governing law</h3>
      <p>
        These Terms are governed by the law of New South Wales, Australia, with
        mandatory informal dispute resolution before any litigation.
      </p>

      <h3>8. Contact us</h3>
      <p>Knotify Pty Ltd · ABN 64 674 946 804 · Sydney, NSW · hello@zebri.com.au</p>
    </LegalSection>
  );
}
