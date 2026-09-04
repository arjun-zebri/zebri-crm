/**
 * /docs/lead-capture-api: public reference for posting enquiries from an
 * MC's own website form. Standalone page (no dashboard shell), content
 * rendered from lib/lead-capture/api-reference so it matches the route.
 *
 * @module app/docs/lead-capture-api/page
 */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { buildExampleHtml } from '@/lib/lead-capture/api-reference';
import { FIXED_LEAD_FIELDS } from '@/lib/lead-capture/fields';

import { CodeBlock } from './_components/code-block';
import { DocSection } from './_components/doc-section';
import { PayloadSection, ResponsesSection, SpamSection } from './_components/reference-sections';

export const metadata: Metadata = { title: 'Lead Capture API · Zebri' };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au';

export default function LeadCaptureApiDocsPage() {
  return (
    <main className="min-h-screen bg-surface-muted px-4 py-16">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        <header className="space-y-4">
          <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} priority />
          <h1 className="text-display font-semibold text-text">Lead Capture API</h1>
          <p className="text-body text-text-muted">
            Build your own enquiry form on your own site and post it straight into your Zebri pipeline. No SDK, no auth, one JSON request.
          </p>
        </header>

        <DocSection id="overview" title="Overview">
          <p>Your form token identifies your form. It is public: it already appears in every embed snippet, so it is safe in front-end code. Find it under Settings, Lead Capture, API access.</p>
          <p>Base URL: <code className="font-mono text-text">{APP_URL}</code></p>
        </DocSection>

        <DocSection id="config" title="Get the form config">
          <CodeBlock code={`GET ${APP_URL}/api/lead/config?token=YOUR_FORM_TOKEN`} />
          <p>Returns the fields to render, in order, so your form matches what the MC configured in Zebri. Each field has id, key, role, label, required, inputType, placeholder and options. key is the payload key to send, or custom for a field sent in the custom array. A disabled form returns enabled false and no fields.</p>
          <CodeBlock code={JSON.stringify({ enabled: true, fields: FIXED_LEAD_FIELDS.slice(0, 2) }, null, 2)} />
        </DocSection>

        <DocSection id="submit" title="Submit an enquiry">
          <CodeBlock code={`POST ${APP_URL}/api/lead/submit\nContent-Type: application/json`} />
          <p>No cookies or credentials. Name is always required; everything else follows the form config.</p>
        </DocSection>

        <PayloadSection />
        <SpamSection />
        <ResponsesSection />

        <DocSection id="cors" title="CORS setup">
          <p>A browser post is cross-origin, so add your site (scheme and host, e.g. https://www.example.com) under Settings, Lead Capture, Allowed domains. The endpoint echoes only listed origins, never a wildcard, and never allows credentials. Until your domain is listed, the browser reports a CORS error.</p>
          <p>Posting from your own server (a serverless function, a form handler) sends no Origin header and needs no setup. If your server forwards the visitor&apos;s form instead of building its own, pass through the browser&apos;s original rendered_at value rather than stamping a fresh one when you forward it: a value newer than the threshold reads as a bot, so the enquiry gets a 200 but is never stored.</p>
          <p>The rate limit and the initial token lookup both run before the origin is checked, so a cross-origin browser post that is rate limited or uses an unknown token sees a CORS error rather than a readable 429 or 404 body.</p>
        </DocSection>

        <DocSection id="example" title="Example">
          <p>A complete form. Replace YOUR_FORM_TOKEN with yours.</p>
          <CodeBlock code={buildExampleHtml(APP_URL, 'YOUR_FORM_TOKEN')} copyLabel="Copy example" />
        </DocSection>

        <DocSection id="ai" title="For AI tools">
          <p>
            Point your AI coding tool at this page, or at the plain-text version below, together with your form token from Settings, Lead Capture. The machine-readable reference is at{' '}
            <Link href="/llms.txt" className="text-text underline">/llms.txt</Link>.
          </p>
        </DocSection>
      </div>
    </main>
  );
}
