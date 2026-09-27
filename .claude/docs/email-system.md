# Email system

Zebri's email surface is, today, a handful of disconnected one-off senders. This
doc specifies a single **email comms platform** for wedding MCs and celebrants:
a reusable template library that powers manual sends, automation actions, and the
existing transactional emails through **one renderer**; per-MC white-label sending
domains; full delivery/open tracking; and inbound reply threading per couple.

> **Status: design only.** Nothing here is built yet. This is the source of truth
> for the phased implementation (§8). When a phase ships, update this doc and the
> cross-referenced docs in §9 in the same PR.

## Problem

Email is scattered and rigid:

- **Transactional sends are hardcoded.** `lib/email/index.ts` holds inline HTML
  for `quoteHtml` / `invoiceHtml` / `contractHtml` / contract-reminder with fixed
  Zebri styling. MCs cannot change a single word.
- **Automations can send email, but nothing is reusable.** The `send_email` action
  (`lib/automations/actions/messaging.ts`) has a working merge-variable resolver
  (`lib/automations/variables.ts`), recipient-role resolver
  (`lib/automations/recipients.ts`), and an HTML wrapper — but the body is typed
  inline per automation. There is no saved template to reuse across automations
  or to send by hand.
- **There is no manual "compose & send".** An MC cannot pick a couple, choose a
  template, tweak it, and send — the everyday core of a CRM.
- **There is no email history, tracking, or inbound.** No `email_messages` log,
  no delivery/open status, and no way to see or thread a couple's replies.
  (The Resend webhook now exists for bounces and complaints only; see
  "Inbound + webhooks" below.)
- **All mail is sent from `noreply@app.zebri.com.au`.** Couples never see the MC's
  own brand in the From line, and replies don't reach the MC.
- **Suppression enforcement.** Every automated send (every workflow action
  that emails, the `send_email` action included) checks `email_suppression`
  and, for the couple's own addresses only, couple `do_not_email` before
  dispatch. The address match ignores case and surrounding whitespace and is
  done in Postgres (`is_email_suppressed`), because the column stores the
  address as typed. A lookup that cannot be completed is neither sent nor
  skipped: it defers the step onto the executor's retry backoff. Emails an MC
  composes and sends by hand in the app (the couple-profile composer's
  `/api/email/send-template`, send-proposal) are not checked, as those are
  human-deliberate actions. The two transactional actions, `send_invoice` and
  `send_contract`, are not checked either (see below).
- **The unsubscribe facility (Spam Act).** Whether an automated send is
  commercial is decided in one place, `lib/email/commercial-classification.ts`:
  everything is commercial except the transactional allow-list (`send_invoice`,
  `send_contract`). The portal link, request information, the run sheet (to
  vendors and to the couple) and the questionnaire are commercial for this
  build, pending the lawyer's answer, which will only edit that allow-list. The
  gate in `lib/email/automation-send.ts` consults it from the action type, so
  an action cannot skip the floor by where its code lives. Each recipient of a
  commercial send gets their OWN token (it encodes the address that copy was
  sent to, so a spouse's or vendor's click never unsubscribes the couple), in
  two URLs: a footer link to the page `/unsubscribe/<token>` (a GET that never
  writes, so link scanners are harmless) and a `List-Unsubscribe` header naming
  `/api/unsubscribe/<token>`, a route handler that records the opt-out on the
  RFC 8058 one-click POST (`List-Unsubscribe=One-Click`) Gmail and Yahoo send.
  The header cannot point at the page: a Next page answers a form POST by
  rendering itself, 200, with nothing written. A commercial body rendered
  without the branded shell (a `send_email` step with `wrap: false`, or a
  renderer that ignored the link) gets the sender identification and
  unsubscribe block appended (`appendComplianceFooter`).
- **`send_email` cc and bcc addresses are their own messages (Task 15c).** On a
  commercial `send_email` (every one today), each cc address (`ccVendors`,
  `ccEmails`) and each typed `bccEmails` address is mailed as its own direct
  message, with its own unsubscribe link and header, its own idempotency key,
  and its own `email_suppression` check. As copies on the couple's message they
  carried the couple's link (a cc'd vendor could unsubscribe the couple), had
  no link of their own, and were never checked against suppression. They are
  not the couple, so the couple's `do_not_email` does not apply to them. An
  address that is already a direct recipient, or appears twice, gets one
  message. They count toward the send-rate weight. **Visible change:** a cc'd
  vendor no longer appears on the couple's cc line, and each cc or bcc address
  receives a separate email (previously a cc'd address received one copy per
  direct recipient). The MC's own address (`bccSelf`, or the MC's address
  typed into cc or bcc) is its own message too, see the next point. A
  transactional `send_email`, if one is ever classified so, keeps cc and
  the typed bcc as copies on every message.
- **The MC's own copy is its own message (Phase 5 fix wave, I1 and P1).**
  It used to be a bcc on each of the couple's messages. That copy carried
  the couple's footer link and `List-Unsubscribe` headers, so the MC
  tidying their own inbox could press Gmail's native Unsubscribe and opt
  the couple out; and a Resend event on that message could not say which
  mailbox it was about, so a full MC inbox marked the couple's row
  bounced. Now `planRecipients` returns `mcCopy` (null when none was asked
  for, or when the MC is already one of the step's own recipients) and the
  couple's message carries no bcc. After the couple's messages, and only
  when at least one of the step's own recipients was reached, `send_email`
  sends the MC one copy through the same transport: the test-send render
  (no unsubscribe link, no `List-Unsubscribe`), the same subject, reply-to
  and attachments, its own idempotency key (`<couple's key shape>:mc-copy`),
  and the tags `tenant` and `mc_copy`. It is never logged to
  `couple_emails`, not counted toward the daily cap (so the brake's worst
  case is about twice the cap: one MC copy per step that reached a direct
  recipient, on top of the counted couple messages), and not counted in the
  step's `sent` or `failed`: its failure is logged and recorded as
  `output.mc_copy = 'failed'`, and fails nothing. The webhook acknowledges
  every event tagged `mc_copy` and does nothing with it. **Visible change:**
  the MC receives one copy per step (before: one per direct recipient), as
  its own email, and the couple's message has no bcc. The idempotency
  fingerprint still hashes the old bcc list (`plan.fingerprintBcc`), so
  every step's per-recipient keys, rows and Resend deduplication are the
  same across the change.
  **Also changed:** the couple's message no longer carries the `copies`
  tag on a `bccSelf` step (it has no bcc now), so a genuine bounce or
  complaint from the couple's own address on such a step suppresses them,
  where before the webhook refused to act on a message with copies. That
  is correct: the event is about the couple's mailbox.
- **Unsubscribe routes never rate-limit a valid token (Task 15c).** Both
  `POST /api/unsubscribe/<token>` (one-click) and `POST /api/unsubscribe`
  (the page's form) verify the token first. A valid token is always honoured:
  the write is idempotent and keyed by the token's address, and Gmail and Yahoo
  send one-click POSTs from shared egress IPs, so a per-IP cap would answer 429
  to real opt-outs in a busy minute. Only invalid tokens are counted per IP
  (`recordInvalidTokenAttempt`, 60/hour plus the burst alert, and
  `UNSUBSCRIBE_RATE_LIMITS.confirm`, 20/minute) and refused past either cap.
- **Microsoft Graph cannot carry `List-Unsubscribe`.** Graph's JSON `sendMail`
  API accepts only `x-` prefixed custom internet headers, so an automated send
  through an Outlook-connected MC's mailbox has no unsubscribe header. The
  footer link in the body is the unsubscribe facility on that transport, which
  is why the appended block above applies to every commercial send, wrapped or
  not. Graph is not rewritten to send raw MIME for this. Gmail (raw MIME) and
  Resend carry the header.
- **Every send has a text/plain part (Task 31, audit M2).** `dispatchEmail`
  (`lib/email/dispatch.ts`) derives it, for every caller, from the exact HTML
  being sent, through `htmlToText` (`lib/email/html-to-text.ts`); a caller may
  pass its own `text` but none does. It is derived from the final HTML, not
  from the TipTap document (`docToText` writes variables back as `{{tokens}}`),
  so it has the variables resolved and carries the same footer: the sender
  identity line, ABN / phone / postal address, and this recipient's
  unsubscribe URL, written as `Unsubscribe (https://...)`. A text part
  without that URL would reopen the Spam Act gap for text-only readers.
  Resend gets it as `text`. Gmail (`buildMime` in `lib/email/mime.ts`) sends
  `multipart/alternative`, text first and HTML last, nested inside
  `multipart/mixed` when there are attachments. Both parts are base64 with a
  `Content-Transfer-Encoding` header, wrapped at 76 characters (fix round 1):
  a TipTap body has no newlines, so sent raw it was one line far past the
  RFC 5322 limit of 998, which a relay may hard-wrap mid-URL, breaking the
  unsubscribe link. The text part is converted to CRLF line ends first. **Microsoft Graph stays
  HTML-only:** `sendMail` takes one `body` with a single `contentType` and has
  no alternative part, so an Outlook-connected MC's mail has no text part. The
  HTML footer is still there; nothing is lost against before.
- **Header values are stripped of line breaks (Task 31, audit M5).** Gmail is
  the one transport where the app writes raw header lines. `buildMime` passes
  every header value (From and its display name, To, Cc, Bcc, Reply-To,
  Subject, and each attachment filename) through `headerValue`, which turns
  CR, LF and every other C0 control character or DEL into a space (tab is
  kept), so a couple name or contact address carrying `\r\n` can never start
  a header of its own. A filename also loses `"` and `\` so it cannot close
  its quotes. Non-ASCII header text is encoded: the subject and a From
  display name ("Zoë MC") as RFC 2047 encoded-words, an attachment filename
  as an RFC 2231 `filename*=UTF-8''...` beside an ASCII fallback. The `List-Unsubscribe` URL was already refused when it held CR
  or LF (`validateHeaderUrl`). Resend and Graph take JSON and are not
  affected. Names and addresses with a line break are also refused where they
  enter (see `security.md`, M5).
- **A failure carries a code.** `DispatchResult.code` is a short token for
  why a send failed (Resend's error name, Gmail's status, Graph's error code,
  `http_<status>`, `invalid_unsubscribe_url`, or `thrown`), reduced to
  letters, digits, `_`, `.` and `-` or else `unknown`. It is what an alert may carry; `error` can quote the
  recipient's address and never goes to Slack.
- **`ok` is the success signal, not the message id (Task 31 fix round 1,
  same rule as 98bb9018 on main).** Microsoft Graph's `sendMail` answers 202
  with an empty body, so an Outlook-connected MC's delivered email has no
  id. `send_email` and the send gate count it as sent and log a `sent`
  `couple_emails` row with a null `provider_message_id`; `send_email`'s
  test send counts it as sent too and logs nothing (it goes to the MC). Before, it counted as a failure: the step errored,
  Try again re-sent to everyone, and on the run sheet a false partial-send
  warning showed.
- **A partial send is visible (Task 31, audit M6).** A step that mails several
  people (`send_email`, the run sheet to vendors, the run sheet link) and fails
  on some of them stays `done`: erroring would re-run it and double-send
  everyone it reached. Its output records `sent`, `failed`, `last_error` and
  `last_error_code`, the step shows a warning instead of the green tick (see
  `page-specs.md`), each failed recipient has its own `failed` row in the
  Emails tab (Task 30; the MC's own run-sheet copy is not logged), and
  `workflow_send_partial_failure` is raised (see `alerts.md`).
- **Every couple-facing shell carries a hidden preheader (Task 32, fix
  round 1 in `lib/email/html.ts`).** The first thing inside `<body>`,
  before the visible card, is a `display:none` element
  (`data-zb-preheader`) holding the inbox-preview sentence Gmail, Apple
  Mail and Outlook show next to the subject. It is auto-derived from the
  start of the rendered body through the one pipeline every shell calls,
  `autoPreheaderHtml`: strip tags (an HTML source only; a plain-text
  source, the automation shell's resolved body, only has its whitespace
  collapsed, since running the HTML tag-stripper on plain text risks
  eating real content that merely contains a `<`/`>`; on an HTML source
  only real tags, a `<` followed by a letter, `/` or `!`, are stripped, so a
  couple name like "Tom <3 Jo" survives), drop any bare `http(s)://` or
  `www.` URL, or a schemeless domain followed by a path
  (`zebri.com.au/portal/<token>`), that a resolved link variable, a pasted
  anchor label or a hand-typed link could have left in view, then cut to ~90-110 characters at a word
  boundary (`derivePreheaderText`, backed off a UTF-16 code unit if it
  would otherwise land inside a surrogate pair). Never a separate
  MC-facing field, so it can never show a raw `{{token}}` or a link's
  token, or say something the body itself does not. `wrapAutomationShell`,
  `wrapTemplateHtml`, the neutral `plainCardHtml` fallback, and the
  hand-rolled no-branding fallbacks in `questionnaireHtml`, `contractHtml`
  and `contractSignedHtml` all render one this way. `contractOtpHtml` is
  the one exception: its body opens with the one-time signing code, so
  auto-deriving from it would put the code straight into the same
  lock-screen preview the code is kept out of the subject line for.
  Both its branded and unbranded paths instead get a fixed, code-free
  preheader ("Your signing code for contract CN-1. It expires in 10
  minutes.") via `wrapTemplateHtml`'s `preheaderText` param, which also
  accepts a caller's own fixed string for exactly this case (`null` still
  means "render none at all"). The element is padded with 90 pairs of
  alternating `&zwnj;`/`&nbsp;` (180 invisible characters) so a client
  that reads past the preheader's own text for its snippet has well over
  100 further characters to get through before it reaches anything
  visible, whether that is a CTA button, the branding header or the
  footer; it never repeats any of them, since it is derived only from the
  body content ahead of all three. `htmlToText` strips the whole element
  by its marker attribute before deriving the text/plain alternative, so
  the preheader's sentence and padding never appear a second time there.
  No dark-mode styling was added alongside it (owner decision, scope
  cut): the element is hidden by three independent mechanisms regardless
  of the client's colour scheme, and needs none.
- **The review preview is the send (Task 28).** `send_email`'s whole render
  chain lives in one pure module, `lib/email/send-email-render.ts`:
  `selectSendEmailSource` (saved template, then composer doc, then legacy
  plain text), `renderSendEmail` (variables, missing-variable check, the
  branded shell with signature and preheader) and `recipientCopyHtml`
  (the legal footer and unsubscribe link, appended when `wrap: false`). The
  send handler in `lib/automations/actions/messaging.ts` and the preview
  (`renderEmailPreview` / `buildStepPreview` in `lib/workflows/review.ts`)
  both call it; nothing re-implements it. A unit test
  (`tests/unit/lib/workflows/preview-send-parity.test.ts`) runs the real
  handler and the preview on the same step and asserts the HTML is
  byte-identical, for a composer body (bold, a list, a link, branding,
  signature), a saved template, a legacy text body, an unwrapped body and
  a set of review edits. A preview never mints a token, dispatches,
  writes `couple_emails` or counts toward the send cap: its unsubscribe
  link is the inert `PREVIEW_UNSUBSCRIBE_URL` (`/unsubscribe/preview`, no
  token, so the page reads it as invalid and opts nobody out; it only
  counts the attempt on its rate limiter), and portal, invoice and
  contract links are the couple's existing ones, read, never created. The
  preview frame (`EmailPreview`) blocks clicks on links (left click,
  keyboard, and middle click via the sandbox); a right-click "open in new
  tab" still works, which is acceptable since the MC owns those links.
  Every render is keyed to the input it was made from
  (`use-server-preview.ts`): while a newer draft is rendering, the older
  email is dimmed under "Updating the preview", never labelled as what
  will be sent, and a failed first render shows an error with Try again.
  Both preview actions are capped at 120 renders a minute per user. Two
  surfaces show it: the step detail modal (the real couple, re-rendered
  with the MC's unsaved edits through `previewStepAction`) and the
  builder's Compose email modal (`previewComposeEmailAction` in
  `app/(dashboard)/workflows/preview-actions.ts`: the MC's most recent
  couple, read through their own RLS client, else a labelled sample
  couple; the MC half of the context is always their real signature and
  branding). The builder's invoice/contract `PreviewEmail`
  (`components/builders/parts/preview-email.tsx`) is a different surface
  (documents, not workflow steps) and stays.
- **The envelope is the send too (Task 29).** The step detail modal shows
  From, To (skipped recipients included, with the reason), Your copy (the
  MC's own copy, marked as its own email), Reply-to, send time and
  attachments above the preview (`StepPreview.envelope`,
  built by `buildSendEnvelope` in `lib/workflows/send-envelope.ts`). None
  of it is re-derived. The send's decisions were pulled out into helpers
  that the send handler itself now calls, and the envelope calls the
  same ones:
  - `lib/email/send-email-plan.ts`: `resolveCopyCandidates` (vendor cc,
    typed cc and bcc), `planRecipients` (the Task 15c split of every cc
    and bcc address into its own message, the MC's own copy as
    `mcCopy`, dedupe), `copiesFor` (the copies a transactional message
    carries; none on a commercial one), `gateOptOuts` (the couple's `do_not_email` for the
    primary and partner only, then `is_email_suppressed` per address;
    an incomplete check is `unknown` with the send's own error text),
    `sendReplyTo` and `sendAttachmentIds`; `COUPLE_OWN_ROLES` moved here.
  - `lib/email/sender-identity.ts`: `chooseSender` is the transport
    decision `resolveSender` makes. `describeSender` reads the same row
    (minus the access token) and decides through it, but never decrypts,
    refreshes or writes. It cannot foresee a connection that breaks
    between the preview and the send, but the send no longer quietly
    switches address when one does (see "An unreachable mailbox" below).
  - `lib/email/send-context.ts`: `templateFileIds` and
    `listAttachmentFiles` (the rows `downloadStaticAttachments` downloads).
  - The config is parsed with the send's own exported
    `sendEmailConfigSchema`, so defaults agree. The send time uses the
    MC's timezone from `user_public_settings.timezone` through
    `loadMcTimezone` (`lib/workflows/mc-timezone.ts`), the same reader the
    executor now uses for scheduling.

  The envelope reads through the MC's own RLS client and writes nothing.
  `tests/unit/lib/workflows/envelope-send-parity.test.ts` runs the real
  handler and the preview on one step and asserts the same people are
  mailed in the same order, the same people are skipped, and From,
  reply-to, the MC's copy and attachment names match.

  **Edits are per field (Phase 5 live check B2).** `ReviewEdits` is
  `{ subject?, content? }`, carrying only what the MC changed.
  `applyReviewEdits(config, edits, template)` writes a subject edit onto
  the step and leaves the stored body exactly as it was, and writes a
  body edit as the editor's TipTap doc: nothing flattens a doc to
  paragraphs, so formatting, links, the signature and variables survive,
  and an unfilled variable in an edited rich body still parks the send.
  A template-backed step is detached on any edit (the send prefers a
  template over the step's words): the template's subject and body are
  copied onto the step, then the edit laid over them, so a subject edit
  still sends the template's body. Its template files are not copied,
  and the envelope patch shows the attachment list without them. A
  legacy plain-text step keeps its `body` on a subject edit and becomes
  a rich-text `content` doc on a body edit, as the Compose modal saves
  it. The server actions validate edits with `reviewEditsSchema`
  (`lib/workflows/review-edits-schema.ts`: subject up to 200 characters,
  the send's own cap; a doc up to 200,000 characters of JSON) and load
  the template through the MC's own client (`applyReviewEditsFor`).
  `tests/unit/lib/workflows/review-edit-fidelity.test.ts` runs the real
  handler on edited configs: a subject-only edit sends the original rich
  HTML with the new subject, and a rich body edit keeps bold, the list,
  the link and the signature and still holds on an unfilled variable.

  **Unknown variables (Phase 5 live check B7).** `isKnownVariable`
  (`lib/automations/variables.ts`) says whether Zebri reads a path at
  all; `invoice.*`, `contract.*`, `task.*` and `questionnaire.*` are open
  (read from the trigger and earlier steps). `renderEmailPreview` splits
  gaps into `unresolved` (known, by label) and `unknown` (by path), and
  the envelope, the envelope patch and the Compose preview carry both.
  An unknown variable still holds a rich-text send, but is worded as
  "not a variable Zebri knows" with the advice to edit the message, and
  `variableLabel` shows it as typed (`{{event.venue}}`), not as a
  title-cased guess ("Venue") that read like a real missing detail. The
  Compose preview's subject marks a gap as `[Venue name]`, the same way
  the step detail does (live check B8).

  An edited preview (the MC typing in the step detail, re-rendered per
  debounced burst) does not rebuild the whole envelope (Task 29 review
  M5, Phase 5 fix wave): an edit changes only the unfilled list and, by
  dropping a saved template, the attached files, so `previewStepAction`
  with edits returns `envelopePatch` (`buildEnvelopePatch`: the attachment
  names, the unfilled list and whether it holds) and the modal lays it
  over the saved step's envelope. The sender read, the recipients and
  the one suppression RPC per recipient run once, when the step opens.

  A held pre-composed email (portal link, questionnaire, contract,
  invoice, run sheet, post-event notes) is not previewed yet (Phase 5
  review I3; the exit criterion "what the MC reads is what the couple
  receives" is scoped to `send_email` on this branch). Its step detail
  says what it sends, its envelope (From by the handler's own sender
  rule, To by the handler's own recipient rule, When), and "Preview not
  available for this email type yet." (`lib/workflows/precomposed-envelope.ts`,
  `StepPreview.precomposed`).
  `tests/integration/workflows/envelope.test.ts` proves it under real RLS:
  a suppressed partner is shown as skipped, another MC's suppression of
  the same address is ignored, and no `couple_emails`,
  `email_suppression` or settings row changes.
- **Unfilled variables are marked in the preview, never in the send
  (Task 29).** `renderSendEmail` takes a preview-only
  `{ highlightMissing: true }`, which `renderEmailPreview` passes, so
  both the step detail and the Compose email previews mark gaps. A rich-text body renders in the existing
  `preview` mode. A legacy plain-text body has each gap wrapped in
  sentinels that become the same amber `data-missing-var` span after the
  shell is built. The span carries inline colours, since the preview
  frame has no app stylesheet. Without the flag the output is what it
  was before the flag existed. Legacy text steps now report their gaps
  too (`missing`, for display only: they still send with the gap blank,
  as they always have). On that plain-text path the hidden inbox-preview
  sentence (preheader) is derived from the unmarked text through
  `wrapAutomationShell`'s optional `preheaderSource`, so it matches the
  send's and its ~110-character cut can never split a marker (review I1:
  a split marker used to swallow the shell's tables into one hidden
  span). `applyMissingHighlights` only pairs a complete opener and closer
  and drops any stray sentinel. The label is HTML-escaped exactly once
  (Task 29 review M1, Phase 5 fix wave): the text around it is already
  HTML when `applyMissingHighlights` runs (TipTap and the sanitiser, or
  the branded shell), so it no longer escapes the label again; unwrapped
  legacy text, which nothing escapes, escapes the label where it is
  marked. The envelope's `unresolvedHolds` carries
  the render's `blocked`, so its warning says whether the step parks or
  sends blank. The preview header shows a subject gap as
  `[Label]` (`StepPreview.subjectPreview`), while the subject field keeps
  the sent subject. The parity test asserts the sent HTML carries no
  highlight markup or sentinel characters, and that a fully filled
  preview is still byte-identical to the send.
- **Send-rate brake.** Every automated send through the shared Zebri domain
  counts against the tenant's burst (20/min) and daily (500/day) limits,
  charged once per step, after the opt-out check (a suppressed recipient costs
  no quota). The gate charges it for the actions that go through it; `send_email`
  charges it itself, only when it is sending through the shared domain rather
  than the MC's own mailbox. A step heavier than the burst limit is admitted
  against a fresh window and drains it, so a run sheet to 25 vendors still
  sends. A breach parks the step (`send_rate_limited`) until the window
  reopens. The daily count is the tenant's automated shared-domain
  `couple_emails` rows of the last 24 hours that actually left: `sent`,
  `delivered`, `bounced`, `complained` or `deferred`, never `failed`
  (Phase 5 fix wave, M1: a retry used to charge its own earlier failures
  against its admission). Deleting a couple no longer resets it: the
  rows' `couple_id` is set null, not cascaded (M2).
- **An unreachable mailbox stops the step, it never swaps the sender
  (Phase 5 fix wave, M7).** Every automated action that sends as the MC
  (`send_email`, the questionnaire, contract, invoice and run-sheet sends)
  resolves its sender through `resolveStepSender`
  (`lib/automations/actions/step-sender.ts`) and
  `resolveSenderForSend` (`lib/email/sender-identity.ts`). A settings read
  that fails, or a token refresh that fails for any reason but a revoked
  grant, is `unavailable`: the step errors, not recoverable, with nothing
  sent, and Try again sends it through the mailbox once it answers. A
  dead connection (`invalid_grant` on refresh, or a stored token that will
  not decrypt) is permanent: `oauth_status` flips from `connected` to
  `failed` with a reason in `oauth_last_error`, `mailbox_disconnected` is
  raised once (only the call that flips the row alerts), and the send
  goes from the shared address, which is also what the envelope and every
  later send now say. The MC-present paths (manual sends, booking and
  notification emails) keep `resolveSender`, which marks a dead
  connection the same way and falls back to the shared address, logged,
  on a transient failure.
- **The send log (Phase 5 fix wave).** `log_automated_send` (migration
  `20261023200000`) keeps one row per message, with three refinements. A
  genuinely new message under an existing attempt key is its own row
  under a derived key (N1): on Resend, a different provider id (a retry
  after the 24 hour idempotency window); on the MC's own mailbox, any
  success, since Gmail and Graph deduplicate nothing. A success
  supersedes the same step's earlier `failed` rows to the same address
  under other keys (M4: the MC fixed the content and sent again), stamping
  `superseded_at`; the status stays `failed` and the Emails tab reads it
  as "Replaced by a later send". Provider ids are unique per tenant and
  transport, not globally (M5: Gmail ids are per mailbox).

## Solution

One template engine, three call paths, one log.

- A single **`email_templates`** library is the source of truth for subject + body.
- A single **shared renderer** resolves merge fields, injects branding, and wraps
  the body in the email shell — so a template looks identical whether sent by hand,
  by an automation, or as a transactional email.
- Every send (and every inbound reply) is recorded in **`email_messages`**, giving
  per-couple history and delivery tracking.
- Each MC can verify their **own sending domain** (`email_domains`) for true
  white-label mail, with a Zebri-domain + Reply-To fallback so mail flows day one.

### Non-goals (deferred)

- Full marketing-automation suite (drip-sequence designer beyond what the
  automations engine already gives), A/B subject testing, link-level click maps.
- Rich WYSIWYG drag-drop email designer — v1 is a focused subject/body editor with
  merge-field insertion and live preview.
- Cross-CRM email analytics dashboards.

## Architecture — one engine, three call paths

```
                       ┌──────────────────────┐
                       │   email_templates    │  ← source of truth (subject+body+merge fields)
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                       │   shared renderer    │  merge resolve + branding + shell
                       │  (lib/email/render)  │
                       └──┬────────┬────────┬─┘
            manual send ──┘        │        └── transactional
        (compose modal)     automation action     (quote/invoice/contract)
                            (send_template_email)
                                  │
                       ┌──────────▼───────────┐
                       │    email_messages    │  ← every send + inbound reply logged
                       └──────────────────────┘
```

**Reuse, do not re-invent.** The renderer is glue over existing parts:

| Need | Reuse |
|---|---|
| Merge-field resolution (`{{couple.name}}`) | `lib/automations/variables.ts` |
| Recipient role → address | `lib/automations/recipients.ts` |
| Couple email resolution (primary vs legacy) | `lib/couples/email.ts` `resolveCoupleEmail` |
| Branding (logo, colour, fonts) | `lib/branding/*` |
| Rate-limit on money/public/email routes | `lib/api/rate-limit` `EMAIL_RATE_LIMITS` |
| Quiet-hours send window | `lib/automations/quiet-hours.ts` |
| Existing HTML shell pattern | `lib/email/index.ts` |

The automation merge syntax (`{{couple.name}}`) is the canonical syntax everywhere
— the manual compose editor and transactional templates use the same tokens, so a
template authored once works in all three paths.

## User stories

- As an MC, I can **save reusable email templates** with merge fields and a live
  preview, and pick from a starter catalogue for my trade.
- As an MC, I can **send a templated email to a couple by hand**, tweak the wording
  first, and see it land in that couple's email history.
- As an MC, I can **use a saved template as an automation step** so a trigger
  (e.g. new enquiry, invoice overdue) sends the right email automatically.
- As an MC, I can **edit the wording of my quote/invoice/contract emails** instead
  of being stuck with Zebri's default copy.
- As an MC, I can **send from my own domain** so couples see my brand, and their
  replies reach me.
- As an MC, I can **see delivery, opens, and bounces**, and read a couple's
  **replies threaded** against their record.

## Data model (documented, not yet migrated)

All tables: owner column `user_id uuid not null references auth.users(id) on
delete cascade`, RLS enabled with base policy `auth.uid() = user_id`. See
`database-schema.md` once migrated.

### `email_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | owner |
| `slug` | text | stable per-user identifier |
| `name` | text | display name |
| `category` | text | `enquiry` \| `pre_event` \| `post_event` \| `nurture` \| `transactional` |
| `subject` | text | merge-field enabled |
| `body_html` | text | authored body (merge-field enabled) |
| `system_key` | text null | set on system templates (`quote_sent`, `invoice_sent`, `contract_sent`, `contract_reminder`, …); null for MC-authored |
| `is_active` | boolean | |
| `created_at` / `updated_at` | timestamptz | |

**System templates** carry a `system_key`. Transactional sends resolve
`system_key` for the MC; if no row exists, the renderer falls back to a built-in
default (the current `lib/email/index.ts` copy). MCs override by editing the
seeded row — never by losing the fallback.

### `email_messages` (outbox + log + inbound)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | owner |
| `couple_id` | uuid null | links history to a couple |
| `event_id` | uuid null | optional event context |
| `template_id` | uuid null | template used (null for free-form / inbound) |
| `direction` | text | `outbound` \| `inbound` |
| `to_address` / `from_address` / `reply_to` | text | resolved addresses |
| `subject` | text | |
| `status` | text | `queued` \| `sent` \| `delivered` \| `opened` \| `bounced` \| `complained` \| `failed` \| `received` (inbound) |
| `resend_message_id` | text null | for webhook correlation |
| `thread_id` | uuid null | groups a conversation |
| `error` | text null | failure reason |
| `sent_at` / `created_at` | timestamptz | |

Mirrors the durable-trail style of `automation_runs` / `contract_audit_log`:
status advances as Resend webhooks arrive.

### `email_domains` (per-MC white-label)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | owner |
| `domain` | text | e.g. `janesmc.com.au` |
| `resend_domain_id` | text | Resend domain handle |
| `status` | text | `pending` \| `verifying` \| `verified` \| `failed` |
| `dkim_records` | jsonb | DNS records to display to the MC |
| `verified_at` | timestamptz null | |

Deep links reuse existing tokens — `quotes.share_token`,
`invoices.share_token`, `contracts.share_token`, `couples.portal_token`. No new
token plumbing.

## Merge fields / variables

The variable namespace aligns with the existing `{{couple.name}}` resolver
(`lib/automations/variables.ts`), extended with document context for transactional
templates. Branding (logo, brand colour, fonts) is injected into the shell from
`lib/branding`, not via merge tokens.

| Token | Source |
|---|---|
| `{{couple.name}}` | `couples.name` |
| `{{couple.partner_1}}` / `{{couple.partner_2}}` | `couples.primary_name` / `secondary_name` |
| `{{couple.email}}` / `{{couple.phone}}` | resolved via `resolveCoupleEmail` / phone |
| `{{event.date}}` / `{{event.venue}}` | earliest `events.date` / `venue` |
| `{{event.countdown}}` | days until event date |
| `{{mc.business_name}}` / `{{mc.phone}}` / `{{mc.website}}` | branding (`auth.users` app/user metadata) |
| `{{mc.abn}}` / `{{mc.instagram}}` / `{{mc.facebook}}` | branding socials |
| `{{quote.number}}` / `{{quote.title}}` / `{{quote.total}}` / `{{quote.expires_at}}` / `{{quote.url}}` | linked quote + share link |
| `{{invoice.number}}` / `{{invoice.title}}` / `{{invoice.total}}` / `{{invoice.due_date}}` / `{{invoice.url}}` | linked invoice + share link |
| `{{contract.number}}` / `{{contract.title}}` / `{{contract.expires_at}}` / `{{contract.url}}` | linked contract + share link |
| `{{portal.url}}` | couple portal link (`couples.portal_token`) |

Unresolved tokens render empty (never literal `{{…}}`), matching the automation
resolver's behaviour.

**Link variables render as labelled links, never as the address.** A
mention for `portal.link`, `portal.partner_link`, `portal.vendor_link`,
`invoice.link`, `contract.link`, `questionnaire.link`, `quote.link` or
`mc.review_link` becomes a `link`-marked text node ("View your portal",
"View and pay your invoice", "Fill in your questionnaire", ...) with the
resolved URL as its `href`. The labels live in `LINK_LABELS`
(`lib/automations/variables.ts`, `linkLabel()`); the editor's variable
popover describes each one as "Inserts a ... link". The review-before-send
editor in the step detail modal holds the message as written (the stored
TipTap doc), so a link variable stays a variable through an edit and
`applyReviewEdits` never has to re-link anything (Phase 5 live check B2;
the textarea that showed the URL, and the re-linking it needed, are
gone). The two plain-text portal emails
(`send_portal_link`, `request_information`) carry their link as the
shell's labelled button instead of a pasted address.

## Template catalogue (the "proper CRM for MCs" content)

Seeded starter templates grouped by lifecycle stage. Each maps to a manual action
and/or an existing automation trigger (see `types/automations.ts`), so the
catalogue doubles as a wiring map for the automations engine.

### Enquiry & booking lifecycle

| Template | Trigger / action |
|---|---|
| Enquiry auto-reply ("thanks, I'll be in touch") | `new_enquiry` |
| Availability confirmed | manual |
| Booking confirmed / welcome pack | `couple_stage_changed` → booked |
| Deposit reminder | `invoice_due` (deposit invoice) |
| Balance-due nudge | `invoice_overdue` |

### Pre-event coordination

| Template | Trigger / action |
|---|---|
| Planning questionnaire request | manual / `request_information` |
| Run-sheet / timeline confirmation | `send_final_run_sheet` / manual |
| Final details check-in | `time_before_event` |
| Vendor introduction | `send_timeline_to_vendors` |
| "One week to go" | `time_before_event` |

### Post-event & retention

| Template | Trigger / action |
|---|---|
| Thank-you | `time_after_event` / `send_thank_you_message` |
| Review / testimonial request | `request_review` |
| Photo / gallery follow-up | `time_after_event` |
| Anniversary message | `anniversary_of_event` |
| Referral request | `send_referral_request` |
| Vow-renewal / re-booking | manual / `anniversary_of_event` |

### Admin & nurture

| Template | Trigger / action |
|---|---|
| Cold-lead nurture | `lead_inactive` |
| Seasonal / holiday greeting | `specific_date_reached` |
| Broadcast / newsletter | manual (bulk) |
| Re-engage inactive couple | `lead_inactive` |

## Sending & deliverability

### Sender identity

Resolution rule, evaluated per send:

1. MC has a `verified` `email_domains` row → **From: MC address on their domain**
   (e.g. `jane@janesmc.com.au`), Reply-To = same. Full white-label.
2. Otherwise → **From: `<MC business name> <noreply@app.zebri.com.au>`**,
   **Reply-To: the MC's own email**, so replies still reach them. This is the
   day-one default; no DNS needed.

Domain verification is a Resend flow: create the domain, surface the DKIM/SPF
records (`email_domains.dkim_records`) for the MC to add to DNS, poll until
`verified`. UI in Settings (§7).

### Guards (reuse)

- **Rate-limit** every send route/action via `lib/api/rate-limit`
  (`EMAIL_RATE_LIMITS`) — money/public/email surfaces.
- **Quiet hours** via `lib/automations/quiet-hours.ts` for automated sends.
- **Suppression**: a hard bounce or spam complaint marks the address suppressed;
  future sends to it short-circuit (logged as `failed` with reason).

### Inbound + webhooks

- `POST /api/resend/webhook` — signature-verified at the boundary (copy the
  Stripe webhook pattern). Updates `email_messages.status` from `delivered` /
  `opened` / `bounced` / `complained` events by `resend_message_id`, and fires the
  already-defined `resend_bounced` / `resend_send_failed` Slack alerts via
  `sendAlert()`.
- **Built so far (workflows trust remediation, Task 14):** the route verifies the
  Svix signature, writes an `email_suppression` row for `email.bounced` and
  `email.complained`, attributes the owner from a `tenant` tag the send path sets
  (`DispatchPayload.tags`), writes nothing for a message sent with cc or bcc
  copies (tagged `copies`, since the event does not say which address failed),
  does nothing at all for the MC's own copy of a `send_email` step (tagged
  `mc_copy`, Phase 5 fix wave),
  and (Task 30) advances the message's `couple_emails` row by `data.email_id`
  = `provider_message_id` on `email.delivered`, `email.delivery_delayed`,
  `email.bounced` and `email.complained`: forward only (sent < deferred <
  delivered < bounced < complained), each timestamp column kept at its first
  value, so replays and out-of-order events change nothing wrong.
  Suppression never waits on it: a failed status write is alerted
  (`app_error`, `resend_webhook_delivery`, deduped) and answers 500 only
  after suppression has run, and only when transient; a schema-shaped
  failure answers 200. An automated message (tagged `src=auto` by
  `send_email` and the send gate) whose row does not exist yet answers 500
  while the event is under ten minutes old, so Resend retries it rather
  than the event being lost to a fast delivery or a failed log write
  (Phase 5 fix wave, M3); past ten minutes it answers 200. Every automated send writes that
  row (`lib/email/send-log.ts`); the planned `email_messages` table above is
  not built. Sends through
  an MC's connected Gmail or Outlook mailbox never touch Resend, so their bounces
  and complaints produce no webhook event and stay invisible.
- Inbound replies are parsed into `email_messages` (`direction = inbound`,
  `status = received`) and threaded onto the couple by `thread_id`.

## UI surfaces

- **Settings → Templates** — new `EmailTemplateManager` alongside the existing
  Quote / Contract / Timeline managers (`app/(dashboard)/settings/templates-section.tsx`):
  list, subject/body editor with merge-field insertion, live preview,
  "reset to system default" for system templates.
- **Settings → Email (or Receive Payments area)** — domain verification card
  (add domain, show DNS records, verification status).
- **Couple / Event profile** — a "Send email" action opening a compose modal
  (template picker → editable subject/body → preview → send), plus an **Emails**
  history tab reading `email_messages`, with inbound replies threaded by
  `thread_id`.
- **Automations inspector** (`app/(dashboard)/automations/[id]/inspector-extended.tsx`)
  — a template-picker field for the `send_template_email` action.

## Phased delivery (build order)

Each phase is its own PR through the standard flow and must meet the §5 Definition
of Done in `production-readiness.md`.

1. **Template library + merge fields.** `email_templates` table + shared renderer;
   Settings `EmailTemplateManager`; migrate the four transactional emails to system
   templates with built-in default fallback (preserve all existing status/token
   side effects — only body rendering changes).
2. **Manual compose & send.** Compose modal on the couple profile + `email_messages`
   outbox; per-couple Emails history (outbound only).
3. **Automation action.** `send_template_email` in the action registry
   (`lib/automations/actions/`) + inspector form + test-run dry-preview.
4. **Email log + delivery/open tracking.** `/api/resend/webhook`, status timeline
   on `email_messages`, per-couple history surfacing delivery/opens.
5. **Inbound replies → per-couple thread.** Inbound parsing, `thread_id`, the
   conversation view.
6. **White-label domains + bounce/complaint handling.** `email_domains`,
   verification flow, From/Reply-To switch, suppression on hard bounce/complaint.

## Security, testing & alerts checklist

Applies per phase (see `security.md`):

- Zod validation on every new route and server action.
- Rate-limit every send and the webhook (`lib/api/rate-limit`).
- Verify the Resend webhook signature at the boundary.
- RLS + integration test proving **cross-tenant denial** for `email_templates`,
  `email_messages`, and `email_domains` (tick the matrix in `security.md`).
- Never reference `SUPABASE_SERVICE_ROLE_KEY` in a `'use client'` file.
- `sendAlert()` wired on send failure and bounce/complaint.
- Unit + integration + e2e green; explicit loading / empty / error UI states;
  desktop + mobile.

### Docs to update as phases land

| Phase touches | Update |
|---|---|
| New tables / RLS | `database-schema.md` |
| Automation action | `automations.md` |
| Slack alerts wiring | `alerts.md` |
| Settings / couple-profile pages | `page-specs.md` |
| Security posture | `security.md` |
| Transactional email behaviour | `payments.md`, `invoicing.md`, `contracts.md` |

## Deploy note: Phase 5 send fidelity

The fix wave changes the payload of every automated Resend send (the new
`src=auto` tag on `send_email` and the shared gate; also the preheader and
non-ASCII attachment names) while keeping every idempotency key the same.
Resend answers 409 to a same-key request whose payload differs, within its
24 hour key window.

- **Deploy while no automated action step with `attempt_count > 0` is
  `pending` or `running`**, so no retry of an already-accepted message
  crosses the deploy:

  ```sql
  select count(*) from public.workflow_steps
   where type = 'action' and attempt_count > 0 and status in ('pending', 'running');
  ```

- **If a step errors with a Resend 409 after the deploy**, its message
  already reached the couple once (the `couple_emails` row stays `sent`,
  since a failure never overwrites a sent row). Do not press Try again on
  it more than 24 hours after the original send: the key has expired by
  then, so it would be a genuine second send.

## Owner tickets

Follow-ups the Phase 5 fix wave recorded rather than built:

- **Preview parity for held pre-composed emails (Phase 5 review I3).**
  The portal link, request for information, questionnaire, contract,
  invoice, payment reminder, run sheet (to vendors, final, link) and
  post-event emails compose their wording inside their handlers. Today a
  held one shows what it sends, its envelope and "Preview not available
  for this email type yet." Full parity means giving each of the ~15
  handlers a `render(ctx)` that the handler and `buildStepPreview` both
  call (the send gate already takes `render`), then previewing through it.
- **Timezone split.** Quiet hours read the MC's timezone from
  `user_metadata.timezone` (then `app_metadata.timezone`, into
  `ctx.mc.quietHoursTimezone` in `lib/automations/context.ts`), while scheduling and the
  step envelope read `user_public_settings.timezone` (`loadMcTimezone`).
  An MC whose two values differ gets quiet hours in one zone and send
  times shown and scheduled in another. Pick one source and migrate the
  other.

## Related files (reuse map)

- `lib/email/index.ts` — current transactional builders + HTML shell pattern.
- `lib/automations/actions/messaging.ts` — `send_email` action to model
  `send_template_email` on.
- `lib/automations/variables.ts` — merge-field resolver (canonical syntax).
- `lib/automations/recipients.ts` — recipient role → address resolution.
- `lib/automations/quiet-hours.ts` — send-window logic.
- `lib/couples/email.ts` — `resolveCoupleEmail` (primary vs legacy column).
- `lib/branding/*` — logo / colour / font / business-name source.
- `lib/api/rate-limit` — `EMAIL_RATE_LIMITS`.
- `app/(dashboard)/settings/templates-section.tsx` — where `EmailTemplateManager`
  slots in.
- `types/automations.ts` — trigger + action unions the catalogue maps to.
- `alerts.md` — `resend_bounced` / `resend_send_failed` alert types to wire.
