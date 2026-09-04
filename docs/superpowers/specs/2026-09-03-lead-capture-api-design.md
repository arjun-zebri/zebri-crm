# Public Lead Capture API: design

**Date:** 2026-09-03
**Status:** approved in chat, ready for implementation plan
**Branch:** new feature branch off `staging`

## 1. Goal

Let an MC build their own enquiry form on their own website and post it into
Zebri, instead of being limited to the hosted page or the iframe embed. The
API is documented publicly, consumable by AI coding tools, and surfaced in
Settings > Lead Capture as a fourth option next to Hosted link / Embed
(iframe) / Embed (script).

The same `GET /api/lead/config` endpoint is also step one of a future inline
(non-iframe) embed, so its shape is designed as the thing that embed would
consume.

## 2. What exists today (verified 2026-09-03)

- `POST /api/lead/submit` (`app/api/lead/submit/route.ts`): in-memory limiter
  5/min/IP (plain-text 429), `parseJsonBody` + `leadSubmitSchema`
  (`lib/lead-capture/schema.ts`), honeypot `hp` + `rendered_at` speed trap
  (`MIN_FILL_MS = 2000`, silent 200 on a bot hit), then the anon
  `submit_lead(token, p_payload)` SECURITY DEFINER RPC. Unknown or disabled
  token both surface as `not_found` → 404. Plan-limit blocks return 200 and
  alert + email the MC.
- No `OPTIONS` export exists. Next.js answers preflights with 204 and no CORS
  headers, so a browser on another domain cannot post today.
- `lead_capture_forms` (one row per MC): `capture_token`, `enabled`,
  `target_status_slug`. `form_submissions` stores every raw payload owner
  isolated. Both are RLS `auth.uid() = user_id`.
- The form's field config lives in `user_branding.branding_blocks->'lead'`
  (`formField` blocks with `role`, `inputType`, `label`, `required`,
  `placeholder`, `options`, `hidden`). When null, the public page renders a
  fixed fallback set (`FixedLeadForm` in `lead-form.tsx`). `get_lead_form`
  (anon RPC) returns `enabled`, `business_name`, `blocks` plus branding
  scalars.
- `couples.lead_source` already exists and the RPC writes `'website'` on
  every form lead. `couples.referral_source` is the couple's own
  "how did you hear about me" answer. What is missing is *which site* the
  enquiry came from.
- `lib/supabase/admin` (service-role client) is already used inside public
  route handlers (`app/api/booking/submit/route.ts`), so a server-only read
  of form config from a route is an established pattern.
- Latent bug: `leadSubmitSchema` hard-requires a valid `email`, but
  `buildLeadPayload` sends `email: ''` when the MC's block tree has no email
  field, so such forms 400 on every submit. Config-driven required fields
  (section 5) fixes this.

## 3. Constraints

- Every hosted form, iframe embed, and script embed in the wild keeps working
  unchanged. `/api/lead/submit` stays at its path with the token in the body.
- Public endpoints expose nothing about the account behind the token: no
  user id, branding internals, pipeline config, allowlist, or plan state.
- The form token is public (it is in every embed snippet). It is an address,
  not a secret. Nothing assumes that knowing it proves anything.
- Match existing conventions: `parseJsonBody`, `inMemoryLimiter`,
  `recordInvalidTokenAttempt`, `sendAlert`, admin client for server-only
  reads, anon + SECURITY DEFINER RPC for the write. No new libraries.
- Design system: primitives only (`Input`, `Button`, `CopyButton`, `Toggle`,
  `Select`), tokens only, ≤ ~150 lines per file.
- Migrations deploy through CI `supabase db push`. Nothing lands on the
  remote DB until then.

## 4. CORS and allowed origins

### Storage

`lead_capture_forms.allowed_origins text[] not null default '{}'`, with a
GIN index (used by the preflight lookup in "Preflight" below).

### Validation on save

New server action `saveAllowedOrigins(origins: string[])` in
`app/(dashboard)/settings/lead-capture/actions.ts`, backed by a pure
`parseAllowedOrigin(input): { ok: true, origin } | { ok: false, error }` in
`lib/lead-capture/cors.ts`:

- Trim. Parse with `new URL()`. Scheme must be `http:` or `https:`.
- Reject when the input has a path other than `/`, a query, a hash, user
  info, or a trailing slash. (`https://example.com/` is rejected so the
  saved value is exactly what a browser sends in `Origin`.)
- Normalise to `url.origin` (lowercase host, default port stripped).
- Max 20 entries, deduplicated, each ≤ 253 + scheme chars.

`http://localhost:<port>` is valid so an MC can develop locally.

### Request-time rules (`lib/lead-capture/cors.ts`, pure)

- `originOf(request)`: the `Origin` header or null.
- `isSameOrigin(origin, request)`: origin host equals the request host. A
  same-origin request is always allowed regardless of the allowlist. This is
  what keeps the hosted page and iframe embed working with an empty list,
  and covers Vercel preview hosts.
- `isAllowedOrigin(origin, allowlist)`: exact string equality after
  normalisation.
- `corsHeaders(origin)`: `access-control-allow-origin: <origin>`,
  `access-control-allow-methods: POST, OPTIONS`,
  `access-control-allow-headers: content-type`,
  `access-control-max-age: 600`, `vary: origin`. Never a wildcard on submit,
  never `access-control-allow-credentials`.
- No `Origin` header → no CORS headers, no origin check, exactly as today.
  Server-side posts and curl are unaffected.

### Preflight (`OPTIONS /api/lead/submit`)

A preflight carries no body, so the handler cannot know which form is being
targeted. Decision: `OPTIONS` echoes the origin when it is registered on
**any** form (`lead_capture_forms.allowed_origins @> array[origin]` via the
admin client, one GIN-indexed query), or when it is same-origin. Otherwise
204 with no CORS headers, which is today's behaviour. The per-form check
happens on `POST`. The only thing a preflight reveals is "some Zebri account
registered this origin", which is not a meaningful leak. Preflights share a
looser limiter (60/min/IP) because browsers cache them.

### On `POST`

After the form lookup: if an `Origin` is present, not same-origin, and not in
this form's list → `403 { error: 'origin_not_allowed' }` with no CORS
headers. The browser reports a CORS error rather than a readable 403; the
docs say so. Empty allowlist means every cross-origin browser post is
refused while server-side posts still succeed.

## 5. `GET /api/lead/config?token=<uuid>`

Public, read-only, credential-free, so a wildcard
`access-control-allow-origin: *` is correct here. Rate limited 60/min/IP.
`cache-control: public, max-age=60`.

Data source: one admin-client read shared with the submit route,
`loadLeadFormConfig(token)` in `lib/lead-capture/load-config.ts` (server
only), which selects `enabled`, `allowed_origins`, `user_id` from
`lead_capture_forms` and `branding_blocks->'lead'` from `user_branding`.
The existing anon `get_lead_form` RPC is not used here because it returns
null for a disabled form, and this endpoint has to tell disabled from
unknown. The route forwards only `enabled` and the derived `fields`;
`allowed_origins`, `user_id`, branding scalars and `business_name` never
leave the server. Unknown token → `404 { error: 'form_not_found' }` and
`recordInvalidTokenAttempt`. Disabled form → `200 { enabled: false,
fields: [] }`.

Response:

```json
{
  "enabled": true,
  "fields": [
    {
      "id": "blk_x",
      "key": "partner_name",
      "role": "partnerName",
      "label": "Partner's name",
      "required": false,
      "inputType": "text",
      "placeholder": "",
      "options": []
    }
  ]
}
```

- `key` is the payload key the answer goes under (`name`, `partner_name`,
  `email`, `phone`, `wedding_date`, `venue`, `referral_source`, `message`)
  or `custom`, meaning "send `{ label, value }` in the `custom` array". This
  is the one addition over the requested shape; without it a third party
  cannot build the payload from `role` alone.
- Hidden blocks (`hidden: true`) are omitted.
- No saved tree → the fixed fallback set, exported once as
  `FIXED_LEAD_FIELDS` in `lib/lead-capture/fields.ts` (name required, email
  required, then partner_name, phone, wedding_date, venue, referral_source,
  message). `FixedLeadForm` is not refactored onto it in this change; the
  constant only has to describe what that form renders.
- `name` is always reported `required: true`, even if the MC's block says
  otherwise, because a couple row needs a name (see 6).

Shared pure helper: `leadFormFields(blocks | null): PublicLeadField[]` in
`lib/lead-capture/fields.ts`. The submit route uses the same function for
the required-field check, so the config a third party reads and the rule the
server enforces cannot drift.

## 6. Submit error contract

Route order: rate limit → JSON parse with a token-only envelope schema
(the rest of the body is carried through untouched) → form lookup
(`loadLeadFormConfig`, section 5) → origin check → disabled check → full
Zod validation → required-field check → bot check → `submit_lead` RPC →
notifications. The token is parsed first so that every field-level error
comes after the origin check and therefore carries CORS headers a
third-party page can read. A body that is not JSON or has no string
`token` is a 400 without CORS headers; a `token` that is not a UUID is a
404.

| Status | Body | When |
|---|---|---|
| 200 | `{ "ok": true }` | Accepted. Also returned, with nothing stored, for a honeypot hit or a submission under 2000 ms after `rendered_at`. |
| 400 | `{ "error": "validation_failed", "message": "...", "fields": { "email": "Enter a valid email address" } }` | Zod failure or a required field missing. `fields` keys are payload keys; a missing custom field is keyed `custom.<label>`. Values are never echoed. |
| 403 | `{ "error": "origin_not_allowed", "message": "..." }` | `Origin` present, not same-origin, not on this form's list. |
| 404 | `{ "error": "form_not_found", "message": "..." }` | Unknown token. Trips the invalid-token limiter. |
| 409 | `{ "error": "form_disabled", "message": "..." }` | Token exists, form switched off. Deliberately reveals existence; accepted because the token is public. |
| 429 | `{ "error": "rate_limited", "message": "...", "retry_after": 12 }` + `Retry-After` header | 5/min/IP on POST. |
| 500 | `{ "error": "server_error", "message": "..." }` | RPC failure, logged. |

Every non-preflight response that passed the origin check carries the CORS
headers for that origin, so the browser can read 400/409/429 bodies.

Zod changes in `leadSubmitSchema`: `email` becomes optional-or-valid (empty
→ undefined) so required-ness comes from config; `hp` and `rendered_at`
unchanged; new optional `referrer: z.string().max(2000)` (see 7). A Zod
issue on a known key maps into `fields`; other issues collapse into
`message`.

Required-field check (`missingRequiredFields(fields, payload)` in
`lib/lead-capture/fields.ts`): a canonical field is present when its payload
key is a non-empty trimmed string; a custom field is present when `custom[]`
has an entry whose `label` matches (case-insensitive, trimmed) with a
non-empty value. `name` is always required.

The `submit_lead` RPC keeps its own name check and `not_found` guard as
defence in depth. The route treats a surprising `not_found` from the RPC as
404 as it does today.

Bot handling stays silent 200. The docs document the honeypot, the 2000 ms
threshold, and the silent acknowledgement explicitly so a developer who
submits their test form in under two seconds knows why nothing arrived.

## 7. Recording where the lead came from

New nullable column `source_origin text` on both `form_submissions` and
`couples`. `submit_lead` gains a third argument `p_source_origin text
default null` and writes it to both rows. The two-argument overload is
dropped in the same migration (a defaulted third argument would make the
two-argument call ambiguous). `lead_source` stays `'website'`.

The server computes `source_origin`; the client cannot set it directly:

| Request | `source_origin` |
|---|---|
| Cross-origin browser post (third-party form) | the `Origin` header, after the allowlist passed |
| Our own embed (`?embed=1`), same-origin post | origin part of the body's `referrer` field, which the embed form sets from `document.referrer`. Trusted only because the request is same-origin. Stored as origin only, never the full URL. |
| Hosted page (`/lead/<token>` without embed) | null |
| Server-side post, no `Origin` | null (known gap; a client-declared source is a possible follow-up) |

`referrer` is ignored on any request that is not same-origin.

UI: `couple-overview.tsx` gains a read-only "Enquiry from" row directly
under Lead source, rendering the host (for example `www.mysite.com`), shown
only when `source_origin` is set. `types/couple.ts` gains the field; the
couples read paths that enumerate columns include it. No backfill.

## 8. Settings > Lead Capture UI

`lead-capture-section.tsx` is near the file limit, so:

- `CopyField` moves to `app/(dashboard)/settings/lead-capture/copy-field.tsx`
  (unchanged markup) and is imported by both sections.
- New `app/(dashboard)/settings/lead-capture/api-access-section.tsx`
  rendered under the three existing copy rows, same label / help text /
  readonly `Input` + `CopyButton` pattern.
- New `app/(dashboard)/settings/lead-capture/allowed-domains.tsx`.

API access section, top to bottom:

1. Heading "API access" with help text: build your own form on your own
   site and post enquiries to this endpoint.
2. `Endpoint` copy row: `${window.location.origin}/api/lead/submit`
   (consistent with the other rows, which also use the live origin).
3. `Form token` copy row, help line: "Safe to put in public code. It
   identifies your form and does not grant access to your account."
4. `Allowed domains`: help text explaining it is only needed when posting
   from a browser, not from a server. One row per saved origin: readonly
   `Input` + ghost `Button` with an `X` icon (`strokeWidth={1.5}`) to
   remove. Below, an `Input` + `Button` "Add domain". Validation errors from
   `parseAllowedOrigin` show through the `Input` `error` prop. Saves
   immediately on add/remove via `saveAllowedOrigins`, matching the
   autosave behaviour of the toggle and status select. Empty state text:
   "No domains yet. Browser posts will be refused until you add one."
5. A text link "Read the API docs" → `/docs/lead-capture-api`.
6. `CopyButton` labelled "Copy AI prompt" (`copiedLabel` "Copied"). Its
   `value` is a function calling `buildAiPrompt({ origin, token, fields })`.
   `fields` come from `ensureLeadForm`, which derives them server-side with
   the same `leadFormFields()` the public config endpoint uses, so the
   prompt matches the live contract even while the form is switched off.

`ensureLeadForm` returns `allowedOrigins` and `fields` in addition to
today's values.

## 9. Docs, llms.txt, AI prompt: one source

`lib/lead-capture/api-reference.ts` (pure) holds the contract as data:
endpoint paths, payload keys with types and limits, spam fields with the
2000 ms threshold, the error table, CORS notes, and a curl + fetch example.
Three consumers:

- `app/docs/lead-capture-api/page.tsx`: public standalone server component
  styled like `/roadmap` (logo, `text-display` title, `bg-surface-muted`),
  rendering the reference plus a complete copy-pasteable HTML + JS example
  with a `CopyButton`. Sections: Overview, Get the form config, Submit an
  enquiry, Payload, Spam protection, Errors, CORS setup, Example, For AI
  tools (link to `/llms.txt`).
- `app/llms.txt/route.ts`: `GET` returning `text/plain` built by
  `buildLlmsTxt(origin)`.
- `buildAiPrompt({ origin, token, fields })`: a self-contained prompt with
  the endpoint, exact payload shape, this form's actual fields and which are
  required, the honeypot + `rendered_at` rules, the error codes, the CORS
  note ("add your site's domain under Allowed domains in Zebri"), and a
  request for a correctly styled, accessible form with client-side
  validation, a success state, and per-field error display driven by the
  400 `fields` map.

Middleware `PUBLIC_ROUTES` gains `/docs` and `/llms.txt` (the matcher only
skips image extensions, so `.txt` would otherwise bounce to `/login`).

## 10. Security review checklist

- Never wildcard on submit, never `allow-credentials`, always `Vary: Origin`
  when echoing.
- Same-origin always allowed: required for existing embeds; carries no new
  risk because it is the same posture as today.
- Allowlist and block tree are read with the service-role client inside the
  route only; no new anon grant. `get_lead_form` is unchanged.
- `/api/lead/config` returns exactly two top-level keys; an integration test
  asserts the key set so a future field cannot leak by accident.
- `referrer` is honoured only on same-origin requests and reduced to its
  origin.
- `source_origin` ≤ 200 chars, written by the RPC from a server-computed
  value.
- 400 bodies contain field keys and messages, never submitted values.
- Public docs page and `llms.txt` are static; no data.
- `recordInvalidTokenAttempt` still fires on 404 from both endpoints.
- The migration drops one function overload; `DROP FUNCTION` is not in the
  destructive-SQL gate, so no marker is needed. New columns are nullable or
  defaulted; no data change.

## 11. Testing

- **Unit** (`tests/unit/lib/lead-capture/`): `parseAllowedOrigin` table
  (accepts, rejects, normalises), `isSameOrigin`, `isAllowedOrigin`,
  `corsHeaders`; `leadFormFields` for block trees, hidden blocks, fallback;
  `missingRequiredFields` including custom labels and the always-required
  name; `buildAiPrompt` and `buildLlmsTxt` contain the endpoint, every
  field, the threshold and each error code; schema test for optional email
  and `referrer`.
- **Integration** (`tests/integration/lead-capture/`): route tests for each
  status code and body shape; `OPTIONS` with registered, unregistered,
  same-origin and absent `Origin`; 403 without CORS headers; 200 with CORS
  headers for an allowed origin; `source_origin` recorded from `Origin` and
  from same-origin `referrer`, ignored on cross-origin `referrer`; config
  endpoint key set, disabled shape, 404; `saveAllowedOrigins` validation
  and RLS (user B cannot change user A's list). Existing tests keep passing
  unchanged, which proves the no-`Origin` path.
- **E2E** (`tests/e2e/lead-capture-api.spec.ts`): Playwright serves a static
  HTML form on `http://127.0.0.1:<port>` that posts to the dev server on
  `localhost`, a real cross-origin browser post. With the origin allowlisted
  the lead appears in Couples with "Enquiry from 127.0.0.1"; without it the
  page shows the form's error state. Existing `lead-capture.spec.ts`
  (hosted + embed) stays green.
- Gates: `npm run typecheck`, `typecheck:strict`, `lint:gate`,
  `check:server-action-exports`.

## 12. Docs to update in the same PR

- `.claude/docs/security.md`: lead-capture section (CORS model, config
  endpoint, error contract) and the RLS matrix rows for the new columns.
- `.claude/docs/database-schema.md`: `allowed_origins`, `source_origin` on
  both tables, the RPC signature.
- `.claude/docs/page-specs.md`: Settings > Lead Capture (API access
  section), couple overview "Enquiry from" row, the public docs page.
- `.claude/docs/testing.md`: the cross-origin e2e fixture.

## 13. Out of scope

- The inline (non-iframe) embed itself.
- A client-declared source for server-side posts.
- Refactoring `FixedLeadForm` onto `FIXED_LEAD_FIELDS`.
- Including `source_origin` in the lead notification email.
- Backfilling `source_origin` for existing couples.
