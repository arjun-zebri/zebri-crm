# Proposals Engine

**Date:** 2026-09-12
**Status:** Approved in brainstorming, ready for planning
**Owner:** Arjun
**Branch:** `feature/proposals-engine` (worktree `mcp-notion-4c915e`), PRs to `staging`
**Supersedes:** `docs/superpowers/specs/2026-07-30-remove-proposals-design.md`
(the removal stands; this is a fresh build, not a revert)

## 1. Goal

Give MCs and Celebrants a Qwilr-style way to send proposals that look
incredible and close the booking in one flow: a full-bleed, branded,
mobile-first web page with a personal note, 1-3 package options with add-ons,
and a Choose, Sign, Pay stepper that produces a real contract and a real
invoice on acceptance. The MC sees who opened it, how long they spent on each
section, which package they lingered on, and where they dropped off.

## 2. Background

Proposals replaced quotes on 2026-07-10 and were removed in full on
2026-07-30 (`36bea3be`, `supabase/migrations/20260731000000_remove_proposals.sql`)
because nobody used them. The brainstorm on 2026-09-12 concluded the failure
was visual quality and the weak close, not the data model. The July SQL is a
reference for RPC shape only (`git show 36bea3be^:supabase/migrations/20260710000000_add_proposals_feature.sql`);
nothing is reverted.

## 3. Locked decisions

Numbered so plans can cite them.

| #   | Decision |
|-----|----------|
| D1  | One global Proposal design surface in Branding plus per-proposal data. No per-proposal block editing. |
| D2  | The public page is a full-bleed scrolling page (new `page` frame mode), mobile-first, with reveal animations. |
| D3  | Per-proposal fields: intro note (rich text), package options and add-ons, hero override, expiry, deposit %, payment schedule, contract template. |
| D4  | Accept is one stepper: choose package, e-sign the contract inline, pay the deposit. |
| D5  | The contract comes from an MC-picked `contract_templates` row. Light signing: typed or drawn signature, no OTP, no vendor countersign. A real `contracts` row is created. |
| D6  | Payment: Stripe Connect card when the MC has Connect, bank details always. **Signature confirms the booking**; payment follows through the generated invoice. |
| D7  | Pricing UX: choose one of 1-3 packages, toggle add-ons, live total. No quantity steppers or multi-select options. |
| D8  | v1 section blocks: `hero`, `introNote`, `video`, `gallery`, `testimonials`, `aboutMe`, `howItWorks`, `faq`, `packages`, `accept`, plus every General block. |
| D9  | Navigation: sidebar item `Proposals` at `/proposals`, a `Proposals` tab on the couple profile, a `Proposal` surface tab in Branding. |
| D10 | Full engagement analytics (per-section time, package views, drop-off) and MC email plus Slack alert on first open, accept, and decline. |
| D11 | Workflow triggers `proposal_sent`, `proposal_opened`, `proposal_accepted`, `proposal_declined`, `proposal_expiring`, `proposal_expired`; action `send_proposal`. |
| D12 | Tailoring: starter designs per role (MC, Celebrant, Both) with sample packages; merge variables; weekend loading and GST carry from packages; travel fee is an add-on item; deposit % lives on the proposal. |
| D13 | In v1: PDF download, portal listing, decline with reason and message, versioning (latest wins, no history table). |
| D14 | Video: uploaded MP4 or WebM (50 MB cap, `proposal-media` bucket) and YouTube or Vimeo embed URLs. |
| D15 | Architecture: extend the existing block system (surface, policy, renderer). No standalone page builder. |
| D16 | Delivery: this one spec, five phased plans (A to E), one branch, every PR to `staging` under the staging-only batch rule. |
| D17 | Proposals do not replace contracts or invoices. A proposal generates both on acceptance; `contracts.proposal_id` and `invoices.proposal_id` are re-added. Manual contracts and invoices are unchanged. |

## 4. How proposals, contracts, and invoices fit together

```
Enquiry -> Proposal (sent) -> couple opens, chooses a package
                                |
                                +-> Contract row created from the chosen template,
                                |   signed inline (Payments -> Contracts, same
                                |   certificate and audit trail as a manual one)
                                |
                                +-> On signature: Invoice row + payment stages
                                    (Payments -> Invoices, same Stripe / bank
                                    payment, same public link and reminders)
```

The proposal stores `contract_id` and `invoice_id`; the contract and invoice
carry `proposal_id`. If the couple signs and abandons the Pay step, the
booking is still confirmed and the invoice sits unpaid under the normal
invoice reminder machinery (D6).

## 5. Data model

Phase A migration `supabase/migrations/<ts>_create_proposals_engine.sql`;
later phases add their own migrations. All through CI `supabase db push`.

### 5.1 Tables

`proposals`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid not null -> auth.users on delete cascade | owner |
| couple_id | uuid not null -> couples on delete cascade | |
| event_id | uuid null -> events | optional |
| proposal_number | text not null | `generate_proposal_number` |
| title | text not null | |
| status | text not null default 'draft' | check in (`draft`,`sent`,`viewed`,`accepted`,`declined`,`expired`) |
| intro_note | jsonb null | TipTap JSON, normalised with `toPlainJSON` |
| hero_override | jsonb null | `{ imagePath?, videoPath?, embedUrl? }` |
| expires_at | date null | |
| deposit_percent | numeric(5,2) null | used when no schedule |
| payment_schedule_id | uuid null -> payment_schedules on delete set null | |
| contract_template_id | uuid null -> contract_templates on delete set null | required to send |
| version | int not null default 1 | bumps on edit after send |
| share_token | uuid not null default gen_random_uuid() unique | |
| share_token_enabled | bool not null default false | flips on send |
| email_sent_at | timestamptz null | |
| first_viewed_at | timestamptz null | |
| view_count | int not null default 0 | |
| last_viewed_at | timestamptz null | |
| accepted_option_id | uuid null -> proposal_options | |
| accepted_addon_selection | jsonb null | array of item ids |
| accepted_at | timestamptz null | |
| declined_at | timestamptz null | |
| declined_reason | text null | short code or label |
| declined_message | text null | free text from the couple |
| contract_id | uuid null -> contracts on delete set null | |
| invoice_id | uuid null -> invoices on delete set null | |
| created_at, updated_at | timestamptz | `updated_at` trigger |

`proposal_options` (snapshot of a package at send time, 1-3 per proposal)

| Column | Type |
|---|---|
| id | uuid pk |
| proposal_id | uuid not null -> proposals on delete cascade |
| user_id | uuid not null |
| position | int not null |
| title | text not null |
| description | text null |
| source_package_id | uuid null -> packages on delete set null |
| pricing_mode | text not null check in (`itemised`,`single`) |
| fixed_price | numeric(10,2) null |
| gst_inclusive | bool not null default true |
| weekend_loading_percent | numeric(5,2) null |
| is_popular | bool not null default false |
| subtotal | numeric(10,2) not null default 0 |

`proposal_option_items`

| Column | Type |
|---|---|
| id | uuid pk |
| option_id | uuid not null -> proposal_options on delete cascade |
| user_id | uuid not null |
| description | text not null |
| note | text null |
| amount | numeric(10,2) not null |
| quantity | numeric(8,2) not null default 1 |
| is_addon | bool not null default false |
| default_included | bool not null default true |
| position | int not null |

`proposal_events` (Phase D)

| Column | Type |
|---|---|
| id | uuid pk |
| proposal_id | uuid not null -> proposals on delete cascade |
| user_id | uuid not null |
| session_id | text not null |
| type | text not null |
| payload | jsonb not null default '{}' |
| created_at | timestamptz not null default now() |

Index `(proposal_id, created_at)`.

Columns added: `contracts.proposal_id`, `invoices.proposal_id` (uuid null ->
proposals on delete set null, indexed); `user_branding.proposal_role` (text
null, Phase B, see 7.5).

Every FK gets an index. `snake_case`, `text` over `varchar`.

### 5.2 RLS

RLS on all four tables. Base policy `auth.uid() = user_id` for every verb.
Child tables (`proposal_options`, `proposal_option_items`, `proposal_events`)
also carry a parent-ownership `exists` clause in `with check` so a user cannot
write rows that point at another tenant's proposal (FK does not consult RLS).
Anonymous access only through `security definer` RPCs granted to `anon`.

### 5.3 RPCs

| RPC | Phase | Behaviour |
|---|---|---|
| `generate_proposal_number(p_user_id)` | A | Same pattern as `generate_invoice_number`. |
| `get_public_proposal(p_token)` | A | Returns null unless `share_token_enabled`. Merges `_user_branding(user_id)` at top level, `branding_blocks` from `_user_branding_blocks(user_id, 'proposal')`, options with items, couple name, event date, venue, `expired` (derived from `expires_at`), status, accepted or declined state. Bumps `view_count` and `last_viewed_at`; sets `first_viewed_at` and status `viewed` on first read of a `sent` proposal. |
| `accept_proposal(p_token, p_option_id, p_addon_selection)` | C | Refuses if expired, declined, or already accepted. Validates the option belongs to the proposal and every add-on id belongs to that option. Snapshots `accepted_option_id`, `accepted_addon_selection`. Creates the `contracts` row (`status 'draft'`, `proposal_id`, `couple_id`, number via `generate_contract_number`, `content` = template content with variables resolved, `require_signer_otp false`, `signing_mode 'parallel'`). Returns the contract id. |
| `finalize_proposal_acceptance(p_contract_id)` | C | Called by the sign route after `sign_contract_v2` succeeds when `contracts.proposal_id` is set. Creates `invoices` (`proposal_id`, items from the accepted option and included add-ons) and `invoice_payment_stages` (proposal schedule, else MC default schedule, else one deposit stage of `deposit_percent`, else one stage of 100%). Sets `proposals.status 'accepted'`, `accepted_at`, `contract_id`, `invoice_id`. Moves the couple to `confirmed` unless already `confirmed`, `paid`, or `complete`. Idempotent. |
| `decline_proposal(p_token, p_reason, p_message)` | C | Sets `declined_at`, `declined_reason`, `declined_message`, status `declined`. Refuses if accepted. |
| `record_proposal_events(p_token, p_session_id, p_events)` | D | Inserts up to 50 events; ignores unknown types. |

### 5.4 Triggers and cron

- `tg_proposals_emit_lifecycle` (Phase E) calls `emit_automation_event` for
  `proposal_sent` (`share_token_enabled` false to true), `proposal_opened`
  (`first_viewed_at` null to set), `proposal_accepted` (`accepted_at` set),
  `proposal_declined` (`declined_at` set). Payload: `proposal_id`,
  `couple_id`, `proposal_number`, `title`, `event_date`, and for accepted the
  option title and total.
- Daily cron `app/api/cron/proposals-expiry/route.ts` (Phase C) behind
  `isCronAuthorized`: stamps `status 'expired'` on `sent` or `viewed`
  proposals past `expires_at` and emits `proposal_expired`. The
  `proposal_expiring` time-emitter (Phase E) emits N days before expiry.

### 5.5 Storage

Bucket `proposal-media` (public, 50 MB, mime `video/mp4`, `video/webm`),
Phase B. Images keep using the `branding` bucket (4 MB).

### 5.6 Types

Regenerate `types/database.ts` with `supabase gen types --db-url ...` into a
temp file and copy over; never hand-edit. Run the local grant-repair SQL after
any `supabase db reset`.

## 6. Dashboard (Phase A)

- **Sidebar:** `Proposals` between Couples and Calendar in
  `app/components/sidebar.tsx` `navItems` and `app/components/mobile-nav.tsx`.
- **List** `app/(dashboard)/proposals/page.tsx` (orchestrator) and
  `proposals-list.tsx`: TanStack table with number, couple, title, status
  pill, sent, last viewed, total, expiry. Row opens the detail page. Explicit
  loading, empty, and error states from `components/ui`.
- **Detail** `app/(dashboard)/proposals/[id]/page.tsx` and
  `proposal-detail.tsx`: status, version, links to the generated contract and
  invoice, engagement summary (Phase D fills it), decline reason and message,
  actions: Edit, Send or Resend, Revert to draft, Download PDF (Phase B),
  Delete.
- **Builder** `components/builders/proposal-builder-modal.tsx` on
  `BuilderModalShell`, split into `parts/proposal-options-editor.tsx`,
  `parts/proposal-addons-editor.tsx`, `parts/proposal-terms.tsx`,
  `parts/proposal-readiness.tsx`, `parts/use-proposal-form.ts`. Flow: couple
  picker, title, up to 3 options from `use-apply-sources.ts` (each an editable
  snapshot; one can be marked popular), add-ons (from package optional items,
  plus free-form such as travel fee), intro note (rich text with variables,
  normalised through `toPlainJSON`), hero override upload, expiry, deposit %,
  payment schedule, contract template. Readiness checklist gates Send: at
  least one option, a contract template, and the Proposal surface ready
  (Phase B adds the surface check). Preview pane reuses
  `builder-preview-pane.tsx`.
- **Server actions** `app/(dashboard)/proposals/actions.ts`:
  `saveProposalAction`, `deleteProposalAction`, `revertProposalToDraftAction`.
  Zod schemas live in `lib/proposals/schemas.ts` (plain module, not a
  `'use server'` file). Saves send the explicit full field list; no
  missing-field-to-null defaults. Options and items are replaced wholesale
  per save with uniform keys on every row.
- **Versioning:** saving a `sent` or `viewed` proposal bumps `version`,
  clears `accepted_*` and `declined_*`, keeps `share_token`, and sets status
  back to `sent`. The public page always renders the latest.
- **Couple profile:** `'proposals'` added to `SECTION_KEYS` in
  `app/(dashboard)/couples/couple-profile-types.ts`; section
  `couple-proposals.tsx` mirrors `couple-contracts` (calm list, no nested
  boxes) with a New proposal button that opens the builder pre-filled.
- **Send** `app/api/email/send-proposal/route.ts` (pattern:
  `send-invoice`): Zod, rate limit, flips `share_token_enabled`, calls
  `sendProposalEmail` (`lib/email/index.ts`, `html.ts`), stamps
  `email_sent_at`, inserts a `couple_emails` row so it shows under the
  couple's Emails tab.
- **Public page (minimal)** `app/proposal/[token]/page.tsx`: `/proposal` and
  `/api/proposal` added to `PUBLIC_ROUTES`; `PublicSurface` gains
  `'proposal'` (the stale `'quote'` is removed); `recordInvalidTokenAttempt`
  on a miss. Until Phase B it renders title, intro note, and options inside
  the 720 px document frame so the flow is testable end to end.

## 7. Design surface and page mode (Phase B)

### 7.1 Surface registration

Add `'proposal'` to: `SurfaceTab` (`types/branding-preview.ts`),
`ALL_SURFACE_TABS` and `enabled_surfaces` default (`lib/branding/enabled-surfaces.ts`
plus a migration for the DB default), `surface-tabs.tsx` `TABS`,
`DOC_SPECIFIC_BY_SURFACE` and `paletteGroupsForSurface`
(`blocks/blocks-by-surface.ts`), `REQUIRED_BY_SURFACE`,
`EXACTLY_ONE_BY_SURFACE`, `MARKER_TYPES` (`blocks/policy.ts`),
`defaultBlocksFor` (`blocks/defaults.ts`), `lib/branding/validate-blocks.ts`,
`VARIABLES_BY_SURFACE` (`lib/branding/document-variables.ts`), and the
preview route `app/branding/preview/[surface]/page.tsx` with a sample
proposal document.

Required and exactly-one: `hero`, `introNote`, `packages`, `accept`.
Markers (render null in the block renderer, surface injects UI):
`introNote`, `packages`, `accept`.

### 7.2 Frame mode

`PublicBlockRenderer` gains `frame: 'document' | 'page' | 'print'`
(default `document`, so existing surfaces do not change).

- `page`: each top-level block renders as a full-width `<section>` with an
  optional `sectionBackground` (colour, image, overlay), an inner column at
  a new `--doc-page-max` token (1100 px), generous vertical rhythm, and a
  reveal animation driven by CSS and an IntersectionObserver hook that
  respects `prefers-reduced-motion`. Hero is `100svh` on mobile.
- `print`: the 720 px document frame with animations off; video blocks
  render a poster and link. Used by `lib/pdf/print-document.tsx` for
  Download PDF.

The branding editor canvas and `/branding/preview/proposal` render in `page`
mode so the MC designs what the couple sees. `canvas-frame.tsx` gains a
`page` variant next to `wide`.

New tokens and any new primitive get an entry on `/design-system` in the
same PR. No raw Tailwind values.

### 7.3 New blocks

`BaseBlock` gains `sectionBackground?: { color?: string; imagePath?: string;
overlay?: number }`, honoured only in `page` mode.

| Block | Config | Required |
|---|---|---|
| `hero` | background `{ kind: 'image' \| 'video' \| 'embed', path or url }`, heading (rich text, Enter = line break, default `{{couple_name}}`), subheading (rich text, Enter = new paragraph), showHeading / showSubheading (absent = shown), overlay 0-100, heightVh 30-100 (legacy height `full` \| `tall` \| `short` as fallback), textAlign `left`\|`center`\|`right`, verticalAlign `top`\|`middle`\|`bottom` | at most one |
| `introNote` | text style only; renders the proposal's `intro_note` | exactly one, marker |
| `video` | `{ kind: 'upload' \| 'embed', path or url }`, caption | |
| `gallery` | 3-12 image paths, layout `grid` \| `masonry` \| `carousel` | |
| `testimonials` | items `{ quote, names, detail, imagePath? }`, layout `carousel` \| `cards` | |
| `aboutMe` | portrait path, heading, body (rich text) | |
| `howItWorks` | steps `{ title, description, icon }` | |
| `faq` | items `{ question, answer }` (accordion) | |
| `packages` | layout `cards` \| `stacked`, showInclusions, ctaLabel; renders this proposal's options and add-ons with a live total | exactly one, marker |
| `accept` | heading, buttonLabel, reassurance (rich text); renders the stepper | exactly one, marker |

Public renderers live in `lib/branding/public-blocks/proposal/<block>.tsx`
(one file each, under 150 lines). Editor renderers move to
`blocks/render-proposal.tsx` so `render.tsx` does not grow. `PublicDocData`
gains `proposal?: { options: PublicProposalOption[]; introNote: RichTextValue
| null; depositPercent: number | null; heroOverride: HeroOverride | null;
expired: boolean; state: 'open' | 'accepted' | 'declined' | 'expired' }`.

### 7.3a Hero editor (rich text + toolbar)

The hero heading and subheading are full `RichText` fields, each with its own
`data-subtarget` so clicking a part points the toolbar's typography controls
at it (heading by default, subheading on click), the same direct-manipulation
mechanism the Invoice title block uses. The heading takes Enter as a line
break (`renderRichTextInline` renders it as phrasing content inside the
`<h1>`, never a nested `<p>`); the subheading takes Enter as a new paragraph.
The floating text toolbar shows whenever a field is focused, caret or
selection, so a variable or a mark can be applied at the caret (a colour
picked with an empty selection is re-applied on picker close so the stored
mark survives the click back into the text).

The hero toolbar (revised 2026-09-16 after the Canva-style audit) is one
row in the general-block idiom: the part being styled and its typography,
then Position (a single 3x3 grid for horizontal + vertical placement), an
overlay **slider** chip shown only when the hero has media, and Include
(show / hide the heading and subheading via `showHeading` /
`showSubheading`). Its typography defaults are the values the hero renders
with (56px heading, white over media) via `heroTextDefaults`, so the size
stepper and colour swatch reflect the canvas. Height is not a toolbar
control: the MC drags the hero's bottom edge (`HeroResizeGrip`), which
writes `heightVh` (30-100, a share of the couple's viewport, snapping to a
full screen); the `full | tall | short` preset survives only as the fallback
for blocks saved before the grip. The section-background row, the
frame-level v-align, and the spacing / radius / border controls are hidden
for the hero (it fills its own section and has no box to frame), and
Duplicate is disabled because the surface allows at most one hero. Media
sources live on the block itself: an empty hero shows an inset drop-zone
outline and one "Add background" menu (Upload image, Upload video, YouTube
or Vimeo link, the last swapping the menu for `EmbedUrlForm` in place),
hidden while the MC is typing in either field; Replace on an embed reopens
the link popover. The block toolbar is bounded to the canvas scroll area
(`data-canvas-scroll`) so a full-screen hero's toolbar slides to the
nearest canvas edge instead of flipping over the surface tabs.

### 7.3b Uniform rich text across every block

Every editable text field on every proposal block is a `ProposalText`
(a `RichText` wrapper), not the older plain `InlineText`: section headings,
FAQ questions and answers, how-it-works step titles and descriptions,
testimonial quotes / names / detail, the video caption, the about-me and
accept headings. So all of them behave the same — select text for the inline
formatting bar, insert `{{ variables }}`, consistent Enter (a one-line label
blurs, a body field starts a paragraph) and Escape, and each field selects
its block on focus. The stored value widens from `string` to `RichTextValue`
(`JSONContent | string`); existing saved strings still render, so there is no
data migration. Public rendering goes through the `Rich` helper
(`renderRichText` / `renderRichTextInline`), which resolves variables and
tolerates the legacy string form. Button labels (`accept.buttonLabel`,
`packages.ctaLabel`) stay plain strings. Per-part toolbar styling is wired
only for fields that have a style override (the headings); item text formats
via the inline bar over its type's role defaults.

### 7.4 Uploads and embeds

Images reuse the `uploadBrandAsset` pattern (`branding` bucket, 4 MB).
`app/(dashboard)/branding/upload-proposal-media.ts` uploads MP4 or WebM to
`proposal-media` with a 50 MB cap and a progress bar. Embed URLs are parsed
by `lib/proposals/embed-url.ts` (pure, unit-tested) into privacy-enhanced
YouTube (`youtube-nocookie.com`) or Vimeo (`dnt=1`) iframes; any other host
is rejected in the editor.

### 7.5 Starter designs per role

First open of the Proposal tab (and the onboarding wizard's documents step)
shows a role chooser: MC, Celebrant, Both. `blocks/proposal-starters.ts`
holds the three block trees with role-specific copy (celebrant: ceremony
writing, legal paperwork and NOIM, rehearsal; MC: run sheet, speeches,
vendor coordination; both: a blend). `lib/proposals/starter-packages.ts`
inserts two sample packages per role only when the user has no packages.
The choice is stored in `user_branding.proposal_role` (text null) so the
chooser does not reappear.

### 7.6 Variables

`VARIABLES_BY_SURFACE.proposal` = couple variables (`couple_name`,
`event_date`, `venue`), business variables, and proposal variables
(`proposal_number`, `expiry_date`, `deposit_percent`, `mc_name`). Resolved
through the existing `resolveVariablesInHtml`.

## 8. The close (Phase C)

### 8.1 Stepper

`app/proposal/[token]/_components/accept-stepper.tsx` orchestrates four
step components (`choose-step.tsx`, `sign-step.tsx`, `pay-step.tsx`,
`done-step.tsx`), each under 150 lines. Desktop: inline panel at the
`accept` marker. Mobile: a bottom sheet. Pricing maths (`GST`, weekend
loading, add-ons, deposit) is pure in `lib/proposals/pricing.ts` and shared
with the builder preview.

1. **Choose:** package cards (popular badge), add-on toggles, live total and
   deposit line.
2. **Sign:** `POST /api/proposal/accept` (Zod, rate limit, token) calls
   `accept_proposal`, then the app publishes the contract with
   `publishContractSnapshot` (one `client` signer from the couple's email)
   and returns the signer `sign_token`. The step embeds
   `components/contracts/sign-form-fields.tsx` (typed or drawn) and posts to
   the existing `/api/contract/sign`. After `sign_contract_v2` succeeds and
   `contracts.proposal_id` is set, the sign route calls
   `finalize_proposal_acceptance`. Contract variables come from
   `lib/contracts/contract-variables.ts`, extended with the proposal totals.
3. **Pay:** `PayWithCardButton` for stage 1 of the generated invoice when
   the MC has Connect (existing `/api/stripe/invoice-payment`); bank
   details from the MC's payment settings always; a "Pay by bank transfer
   later" link skips.
4. **Done:** confirmation, the portal link, Download PDF.

### 8.2 Decline

`POST /api/proposal/decline` calls `decline_proposal(token, reason,
message)`. Reasons: `price`, `date`, `other_vendor`, `other`. The page then
shows a declined state with the MC's contact details.

### 8.3 Expiry

`get_public_proposal` returns `expired: true` past `expires_at`; the page
shows an expired state with the MC's contact details and `accept_proposal`
refuses. The daily cron (5.4) stamps the status.

### 8.4 Notifications

`sendProposalAcceptedEmail` and `sendProposalDeclinedEmail` to the MC
(Resend). `sendAlert` gains `proposal_accepted` and `proposal_declined`
(`lib/alerts/events.ts`, documented in `alerts.md`).

### 8.5 Security

`security-reviewer` pass at the end of Phase C: token gating, rate limits on
`accept`, `decline`, `events`, and `send`, no service-role key in client
files, RLS tests, idempotent finalisation.

## 9. Engagement (Phase D)

- **Tracker** `app/proposal/[token]/_components/engagement-tracker.tsx`:
  `session_id` in `sessionStorage`; IntersectionObserver per section and
  per package card; `visibilitychange` pauses timers; batch flush every 10 s
  and on `pagehide` through `navigator.sendBeacon` to
  `POST /api/proposal/events` (Zod, 50 events max, rate limit, token) which
  calls `record_proposal_events`.
- **Event types:** `opened`, `section_viewed { blockId, seconds }`,
  `package_viewed { optionId, seconds }`, `package_selected { optionId }`,
  `addon_toggled { itemId, on }`, `step_reached { step }`, `accepted`,
  `declined`.
- **Aggregation** `lib/proposals/engagement.ts` (pure, unit-tested):
  sessions, total time, seconds per section, package lingered on, drop-off
  step.
- **Detail page:** `proposal-engagement.tsx` (views, last viewed, total
  time) and `proposal-engagement-timeline.tsx` (per-session timeline,
  per-section bars, drop-off).
- **First open:** MC email plus `sendAlert('proposal_opened')`.

## 10. Integrations (Phase E)

- **Workflows:** triggers in `lib/automations/triggers.ts` and the
  `TriggerType` union in `types/automations.ts` for the six proposal events,
  with chip filters (days before expiry, option or package). Time-emitter
  `lib/automations/time-emitters/proposal-expiring.ts`. Action
  `send_proposal` in `lib/automations/actions/documents.ts` (sends the
  couple's latest draft). `buildManualSendContext` adds `proposal_link` and
  `proposal_number`. Workflow `on_event` rules pick these up through
  `getTriggerSpec` with no engine change.
- **Portal:** `get_portal_data` regains a `proposals` key (latest non-draft:
  title, status, link) and `app/portal/[token]/payments-section.tsx` shows a
  "Your proposal" card.
- **Docs sweep:** `page-specs.md`, `database-schema.md`,
  `frontend-design.md` and `/design-system`, `document-blocks.md`,
  `workflows.md`, `alerts.md`, `security.md` RLS matrix, `testing.md`,
  `production-readiness.md`, and a new `.claude/docs/proposals.md`.
- **Gates:** ratchet `typecheck-strict-gate.mjs` and `lint-gate.mjs` down.

## 11. Out of scope for v1

Version history snapshots; an in-app notification inbox; OTP or vendor
countersign inside the proposal flow; per-proposal block editing; a stock
imagery library; multi-select options and quantity steppers; A/B variants.

## 12. Testing

- **Unit** (`tests/unit/`): pricing maths, engagement aggregation, embed URL
  parsing, block renderers in each frame mode, readiness checks, event
  batching, proposal schemas.
- **Integration** (`tests/integration/`, local Supabase): cross-tenant RLS
  denial for `proposals`, `proposal_options`, `proposal_option_items`,
  `proposal_events` (tick the matrix in `security.md`); token gating and
  expiry in `get_public_proposal`; `accept_proposal` then `sign_contract_v2`
  then `finalize_proposal_acceptance` creates contract, invoice, and stages
  and moves the couple to `confirmed`; idempotent finalisation; decline;
  `record_proposal_events` cap.
- **E2E** (Playwright desktop, Pixel 5, iPhone 12): create, send, open as a
  logged-out visitor (`browser.newContext()`), choose, sign, pay by bank,
  confirmed; declined path; expired path; engagement timeline on the detail
  page. Run against the isolated dev server on local Supabase.
- **Review:** whole-branch code review before the staging PR, plus the
  `security-reviewer` pass after Phase C.

## 13. Phases

| Phase | Delivers | Sendable state |
|---|---|---|
| A | Migration, RLS, `generate_proposal_number`, `get_public_proposal`, sidebar, list, detail, builder, couple tab, send email, minimal public page | Sendable and viewable in the document frame |
| B | Proposal surface, page frame, ten blocks with public and editor renderers, uploads and embeds, starters per role, variables, PDF | Beautiful |
| C | Accept and decline RPCs, stepper, contract generation and inline sign, invoice and stages, couple confirmed, expiry cron, MC notifications, security review | Closes the booking |
| D | `proposal_events`, tracker, events API, engagement summary and timeline, first-open notification | Alive |
| E | Workflow triggers and action, portal card, docs sweep, gate ratchet | Integrated |

Rough cost: five plans, two to three days of agent wall-clock including
review cycles. Cheapest exit: ship A and B (sendable and beautiful, with the couple replying
by email to accept) and defer C to E.
