/**
 * Inline Zebri Privacy Policy rendered inside the Settings modal.
 * Copy mirrors zebri.com.au/privacy (canonical).
 *
 * @module app/(dashboard)/settings/privacy-section
 */
'use client';

import { LegalSection } from './legal-section';

export function PrivacySection() {
  return (
    <LegalSection title="Privacy Policy" lastUpdated="10 March 2026" canonicalUrl="https://www.zebri.com.au/privacy">
      <p>
        Zebri is operated by Knotify Pty Ltd (ABN 64 674 946 804), based in Sydney,
        NSW, Australia. This policy explains how we collect, use, and protect your
        information. We are bound by the Privacy Act 1988 (Cth) and the Australian
        Privacy Principles (APPs).
      </p>

      <h3>1. Information we collect</h3>
      <ul>
        <li><strong>Account information:</strong> name and email at registration; billing data via Stripe for paid plans. We do not store full payment card details.</li>
        <li><strong>Content you create:</strong> couple records, contact details, run sheets, timelines, vendor information, notes, scripts, invoices, and files, all of which belong to you.</li>
        <li><strong>Usage data:</strong> pages visited, features used, session duration, browser type, operating system, and IP address (via PostHog).</li>
        <li><strong>Communications:</strong> support enquiries and contact details, retained for response and record-keeping.</li>
        <li><strong>Cookies:</strong> session management and analytics only. We do not use advertising or tracking cookies.</li>
      </ul>

      <h3>2. How we use your information</h3>
      <p>
        To provide the service, process transactions, respond to support, analyse and
        improve the product, and comply with legal obligations. We do not sell, rent,
        or trade your personal information to third parties.
      </p>

      <h3>3. Third-party processors</h3>
      <ul>
        <li>Vercel: infrastructure (SOC 2 Type 2)</li>
        <li>Supabase: database and authentication</li>
        <li>Stripe: payment processing (PCI DSS Level 1)</li>
        <li>Resend: transactional email</li>
        <li>PostHog: anonymised usage analytics</li>
      </ul>

      <h3>4. Data retention</h3>
      <p>
        Your data is retained while your subscription is active. After cancellation or
        account closure it is retained for 30 days and then deleted; backups purge
        within 90 days.
      </p>

      <h3>5. Data security</h3>
      <p>
        We use TLS encryption in transit, encrypted storage at rest, and access
        controls. No method of transmission is 100% secure.
      </p>

      <h3>6. International transfers</h3>
      <p>
        Infrastructure providers may use non-Australian data centres (particularly in
        the US), with appropriate safeguards via certified providers.
      </p>

      <h3>7. Your rights</h3>
      <p>
        Under the Australian Privacy Principles you may access, correct, delete, and
        opt out, and lodge a complaint with the OAIC (oaic.gov.au). Contact
        hello@zebri.com.au, we respond within 30 days.
      </p>

      <h3>8. Children</h3>
      <p>The platform is not directed at, and is not intended for, persons under 16.</p>

      <h3>9. Changes &amp; governing law</h3>
      <p>
        Material updates trigger email notice at least 14 days before they take effect.
        This policy is governed by the law of New South Wales.
      </p>

      <h3>10. Contact us</h3>
      <p>Knotify Pty Ltd · ABN 64 674 946 804 · Sydney, NSW · hello@zebri.com.au</p>
    </LegalSection>
  );
}
