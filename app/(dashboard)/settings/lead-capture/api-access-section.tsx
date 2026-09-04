/**
 * "API access" block of the Lead Capture settings: the endpoint, the form
 * token, the CORS allowlist and a link to the reference. For MCs who want a
 * form of their own design rather than the hosted page or an embed.
 *
 * @module app/(dashboard)/settings/lead-capture/api-access-section
 */
'use client';

import Link from 'next/link';


import { AllowedDomains } from './allowed-domains';
import { CopyField } from './copy-field';

export interface ApiAccessSectionProps {
  /** The app origin, e.g. https://app.zebri.com.au. */
  origin: string;
  token: string;
  allowedOrigins: string[];
  onAllowedOriginsChange: (next: string[]) => Promise<string | null>;
}

export function ApiAccessSection({ origin, token, allowedOrigins, onAllowedOriginsChange }: ApiAccessSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-body font-semibold text-text">Build your own form</h3>
        <p className="mt-1 text-body text-text-muted">
          Only if you want a form you design yourself. Post it to this endpoint and
          enquiries arrive the same way.{' '}
          <Link href="/docs/lead-capture-api" target="_blank" rel="noreferrer" className="text-text underline">
            Read the docs
          </Link>
          .
        </p>
      </div>

      <CopyField
        label="Endpoint"
        value={`${origin}/api/lead/submit`}
        tooltip={"Send your form's answers here as JSON, with the form token included."}
      />

      <CopyField
        label="Form token"
        value={token}
        tooltip={
          'Identifies your form. Safe to put in public code: it does not grant access to your account.'
        }
      />

      <AllowedDomains origins={allowedOrigins} onChange={onAllowedOriginsChange} />
    </div>
  );
}
