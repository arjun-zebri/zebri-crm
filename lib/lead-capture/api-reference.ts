/**
 * The public lead API contract as data, plus the three text renderings built
 * from it: the docs page and `/llms.txt`.
 * Keeping the contract in one module means the prompt an MC pastes into an
 * AI tool can never disagree with what the route enforces.
 *
 * Plain text only, no markdown tables: the prompt is pasted into tools that
 * may or may not render markdown.
 *
 * @module lib/lead-capture/api-reference
 */
import type { LeadApiErrorCode } from './api-responses';
import { MIN_FILL_MS } from './schema';

/**
 * The speed trap: submissions under this many seconds after `rendered_at` are
 * dropped. Derived from {@link MIN_FILL_MS}, the value the submit route
 * actually enforces, so the documented threshold can't drift from it.
 */
export const MIN_FILL_SECONDS = MIN_FILL_MS / 1000;

/** Every response the submit endpoint can give, in status order. */
export const LEAD_API_ERRORS: Array<{ status: number; code: LeadApiErrorCode | 'ok'; when: string }> = [
  { status: 200, code: 'ok', when: 'Accepted. Body is { "ok": true }. Also returned, without storing anything, when the honeypot is filled or the submission is faster than the speed trap.' },
  { status: 400, code: 'validation_failed', when: 'A field is invalid or a required field is missing. Body has "fields": { "<key>": "<message>" }; show each message under its input. Custom fields are keyed "custom.<label>".' },
  { status: 403, code: 'origin_not_allowed', when: 'The page’s origin is not on the form’s Allowed domains list. The browser reports this as a CORS error, not a readable 403.' },
  { status: 404, code: 'form_not_found', when: 'Unknown token.' },
  { status: 409, code: 'form_disabled', when: 'The MC has switched the form off.' },
  { status: 429, code: 'rate_limited', when: 'More than 5 submissions a minute from one IP. Body has "retry_after" in seconds, also sent as a Retry-After header. A browser post from another site that hits this limit sees a CORS error rather than this body.' },
  { status: 500, code: 'server_error', when: 'Something failed on our side. Try again later.' },
];

/** The submit payload, key by key. */
export const LEAD_PAYLOAD_KEYS: Array<{ key: string; type: string; note: string }> = [
  { key: 'token', type: 'string', note: 'The form token. Required.' },
  { key: 'name', type: 'string', note: 'The couple’s name. Always required, max 120 characters.' },
  { key: 'partner_name', type: 'string', note: 'Max 120.' },
  { key: 'email', type: 'string', note: 'A valid email address when present, max 200.' },
  { key: 'phone', type: 'string', note: 'Max 40.' },
  { key: 'wedding_date', type: 'string', note: 'YYYY-MM-DD.' },
  { key: 'venue', type: 'string', note: 'Max 200.' },
  { key: 'referral_source', type: 'string', note: 'How the couple heard about the MC, max 200.' },
  { key: 'message', type: 'string', note: 'Max 2000.' },
  { key: 'custom', type: 'array of { "label": string, "value": string }', note: 'Answers to the MC’s custom fields, keyed by the field label. Up to 30.' },
  { key: 'hp', type: 'string', note: 'Honeypot. Render a hidden text input a person never sees and send its value here. Must be empty.' },
  { key: 'rendered_at', type: 'number', note: `The moment the visitor’s form was rendered, in milliseconds (Date.now() when it mounted). Submissions under ${MIN_FILL_SECONDS} seconds later are treated as bots. A server-side forwarder must pass through the browser’s original value rather than stamping a fresh one: a value newer than the threshold reads as a bot, so the enquiry gets a 200 but is never stored.` },
];

const endpoints = (origin: string) => ({
  submit: `${origin}/api/lead/submit`,
  config: `${origin}/api/lead/config?token=`,
  docs: `${origin}/docs/lead-capture-api`,
  llms: `${origin}/llms.txt`,
});

const errorLines = () => LEAD_API_ERRORS.map((e) => `${e.status} ${e.code}: ${e.when}`).join('\n');
const payloadLines = () => LEAD_PAYLOAD_KEYS.map((k) => `- "${k.key}" (${k.type}): ${k.note}`).join('\n');

/** A working HTML + JS example with the token filled in. */
export function buildExampleHtml(origin: string, token: string): string {
  const e = endpoints(origin);
  return `<form id="enquiry">
  <label>Your name <input name="name" required></label>
  <label>Email <input name="email" type="email" required></label>
  <label>Message <textarea name="message"></textarea></label>
  <div style="position:absolute;left:-9999px" aria-hidden="true">
    <input name="company_website" tabindex="-1" autocomplete="off">
  </div>
  <button type="submit">Send enquiry</button>
  <p id="enquiry-status" role="status"></p>
</form>
<script>
  const form = document.getElementById('enquiry');
  const status = document.getElementById('enquiry-status');
  const renderedAt = Date.now();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const res = await fetch('${e.submit}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: '${token}',
        name: data.get('name'),
        email: data.get('email'),
        message: data.get('message'),
        hp: data.get('company_website'),
        rendered_at: renderedAt,
      }),
    });
    if (res.ok) {
      form.reset();
      status.textContent = 'Thanks, we will be in touch soon.';
      return;
    }
    const body = await res.json().catch(() => ({}));
    status.textContent = body.message || 'Something went wrong. Please try again.';
  });
</script>`;
}

/** The whole reference as plain text for AI coding tools. */
export function buildLlmsTxt(origin: string): string {
  const e = endpoints(origin);
  return [
    '# Zebri Lead Capture API',
    '',
    '> Post wedding enquiries from your own website form into a Zebri account. The form token is public; there is no authentication.',
    '',
    '## Get the form config',
    `GET ${e.config}<token>`,
    'Returns { "enabled": boolean, "fields": [ { "id", "key", "role", "label", "required", "inputType", "placeholder", "options" } ] }.',
    '"key" is the submit payload key, or "custom" for a field sent inside the "custom" array as { "label", "value" }. A disabled form returns enabled false and no fields. Unknown token: 404. Any origin may call this.',
    '',
    '## Submit an enquiry',
    `POST ${e.submit}`,
    'Content-Type: application/json. Body keys:',
    payloadLines(),
    '',
    '## Spam protection',
    `Send "hp" (must be empty; a hidden input a person never sees) and "rendered_at" (Date.now() when the form mounted). Submissions under ${MIN_FILL_SECONDS} seconds after rendered_at, or with a filled honeypot, get a 200 and are not stored. A server-side forwarder must pass through the browser’s original rendered_at rather than stamping a fresh one at forward time, or every lead it forwards will silently fail the threshold and never be stored.`,
    '',
    '## Responses',
    errorLines(),
    '',
    '## CORS',
    'Browser posts need the page’s origin (scheme + host, e.g. https://www.example.com) added under Settings > Lead Capture > Allowed domains in Zebri. Server-side posts have no Origin header and need nothing. The submit endpoint echoes only listed origins, never a wildcard, and never allows credentials.',
    'The rate limit and the initial token lookup run before the origin is checked, so a cross-origin browser post that hits either one sees a CORS error rather than a readable 429 or 404 body.',
    '',
    `## Docs\n${e.docs}`,
  ].join('\n');
}
