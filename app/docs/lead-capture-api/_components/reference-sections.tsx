/**
 * The data-driven sections of the docs page: payload keys, spam rules,
 * responses. Rendered from lib/lead-capture/api-reference so they cannot
 * drift from the route.
 *
 * @module app/docs/lead-capture-api/_components/reference-sections
 */
import { LEAD_API_ERRORS, LEAD_PAYLOAD_KEYS, MIN_FILL_SECONDS } from '@/lib/lead-capture/api-reference';

import { DocSection } from './doc-section';

export function PayloadSection() {
  return (
    <DocSection id="payload" title="Payload">
      <p>JSON body. Send only the keys for the fields you render, plus token, hp and rendered_at.</p>
      <ul className="space-y-2">
        {LEAD_PAYLOAD_KEYS.map((k) => (
          <li key={k.key}>
            <code className="font-mono text-text">{k.key}</code>
            <span className="text-text-subtle"> ({k.type})</span> {k.note}
          </li>
        ))}
      </ul>
    </DocSection>
  );
}

export function SpamSection() {
  return (
    <DocSection id="spam" title="Spam protection">
      <p>
        Two fields are required on every request. <code className="font-mono text-text">hp</code> is a honeypot: render a text input named company_website that a person never sees (hidden with CSS, aria-hidden, tabindex -1, autocomplete off) and send its value. It must be empty.
      </p>
      <p>
        <code className="font-mono text-text">rendered_at</code> is Date.now() captured when the form mounted. A submission under {MIN_FILL_SECONDS} seconds later is treated as a bot. Bot submissions are acknowledged with a 200 and not stored, so if you test your form very quickly and nothing arrives, that is why.
      </p>
    </DocSection>
  );
}

export function ResponsesSection() {
  return (
    <DocSection id="responses" title="Responses">
      <p>Every non-200 body is JSON: {'{ "error": "<code>", "message": "..." }'} plus any extra keys listed below.</p>
      <ul className="space-y-2">
        {LEAD_API_ERRORS.map((e) => (
          <li key={e.code}>
            <code className="font-mono text-text">{e.status} {e.code}</code> {e.when}
          </li>
        ))}
      </ul>
    </DocSection>
  );
}
