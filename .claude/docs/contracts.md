# Contracts (e-sign)

Zebri includes a minimal, legally-valid e-signature flow so a supplier can send
service agreements and have the couple sign them without leaving the CRM.

**Terminology:** the product no longer hard-codes "MC". The client-facing noun
comes from `resolveVendorRole()` (`lib/branding/vendor-role.ts`): the free-text
`vendor_role` override in Settings, else the `business_type` multi-select
(MC / Celebrant / DJ, joined for multi-select users), else "supplier". It is
exposed to documents as the `{{vendor_role}}` variable and to every public
surface via `_user_branding()`.

> **Historical note:** signing no longer spawns a deposit invoice. `quotes` was
> dropped in `20260711000000` and `proposals` in `20260731000000`; invoices are
> fully manual.

## Status lifecycle

```
draft ──send──▶ sent ──sign──▶ signed
                 │  ──decline──▶ declined
                 │  ──expiry──▶ expired
                 └──revoke──▶ draft (new version, new token)
```

- **draft**  -  content is editable; no public link. `share_token_enabled` is true from insert
  (so a copied link never 404s later), but `get_public_contract` and `record_contract_view`
  refuse drafts and the builder hides Copy link / Open until sent: there is no body to show.
- **sent**  -  content is locked (`locked_content_html` is the frozen, variable-substituted snapshot). Public link active.
- **signed**  -  immutable. Audit trail is populated (`signer_name`, `signer_ip`, `signer_user_agent`, `signed_at`). Nothing else is created; invoices are manual (see the historical note above).
- **declined**  -  terminal; `declined_reason` optional.
- **expired**  -  flipped nightly by `expire_contracts()` cron.
- **revoked**  -  old link is dead; status resets to `draft`, `version` bumps.

## Where the heading comes from

The **Contract header block** in Branding owns the document's heading.
`blockTemplate('title', 'contract')` ships `title: 'Contract'` and the block
model was always built this way ("the header then reads as the contract title
+ couple name"), but `RenderTitle` only ever rendered `doc.title`, so a title
typed in the Branding editor silently did nothing.

- `lib/branding/public-blocks/title.tsx` renders `doc.title || block.title`.
- `contracts.title` is an optional **per-contract override** plus the label in
  the Payments and couple lists. It is nullable and is **never**
  auto-generated: the old fallbacks (`Contract for <couple>` in the modal,
  `Untitled contract` in the server action) printed wording the sender never
  wrote as an `<h1>` on the signed document and in the PDF.
- The shipped templates therefore start at their first clause. A leading
  heading in the body would print a second one directly under the header.

### Contract header defaults

`blockTemplate('title', 'contract')` and the default contract tree both ship
`showCoupleName`, `showRef` and `showAbn` on, and `showExpires` **off**.

The reference identifies the document and the ABN identifies the supplier as a
legal party, so an agreement carries both. Expiry stays off because
`contracts.expires_at` is a **signing deadline**, not a term: the
`expire_contracts` cron flips an unsigned sent contract to `expired` and the
public page then offers a new link. Labelling that "Expires" on the document
reads as the agreement itself lapsing.

Supplier phone and website are not on the header at all. They come from the
**Footer** block, which is addable to any surface but is not in the default
contract tree.

## Content authoring

Contracts are authored with TipTap (StarterKit + Mention + **TableKit**).
Tables are opt-in per surface (`<RichTextEditor tables />`) because a table node
reaching a renderer that has not registered the extension throws
`Unknown node type: table`. `renderContractHtml` registers TableKit for exactly
this reason, and the sanitiser keeps `colspan` / `rowspan` / `colwidth` so
merged cells and column widths survive.

Variables are inserted as Mention nodes and substituted at **send time**.
`findUnknownVariables()` blocks a send whose body references a variable the
resolver cannot supply. Without it the renderer silently emits the literal
`{{token}}` into the immutable snapshot the couple signs, which is exactly how
`{{total_amount}}` shipped in the seeded default template.

| Token | Source |
|---|---|
| `{{couple_name}}` | Both partners in full via `coupleDisplayName()`: `primary_name` and `secondary_name`, falling back to one partner, then legacy `couples.name` |
| `{{couple_email}}` | `couples.email` |
| `{{event_date}}` | earliest `events.date` |
| `{{venue}}` | earliest `events.venue` |
| `{{mc_business_name}}` | `auth.users.raw_user_meta_data.business_name` |
| `{{vendor_role}}` | `resolveVendorRole()`, e.g. "MC" / "DJ" / "Celebrant" |
| `{{partner_1_name}}` | `couples.primary_name`, falling back to `couples.name` |
| `{{partner_2_name}}` | `couples.secondary_name` |
| `{{mc_abn}}` | `raw_user_meta_data.abn` (Branding to Business) |
| `{{mc_email}}` | `auth.users.email` |
| `{{mc_phone}}` | `raw_user_meta_data.phone` |
| `{{mc_website}}` | `raw_user_meta_data.website` |
| `{{mc_address}}` | `raw_user_meta_data.address_text` |
| `{{mc_signature_name}}` | `raw_user_meta_data.mc_signature_name` |
| `{{today}}` | date sent |

See `lib/contract-variables.ts` for the catalog and rendering helpers.

## Signing

**Multiple signers.** A contract has a roster of `contract_signers` rows, one
per party. Each carries its own `sign_token`, so both partners sign
independently and are evidenced separately (own IP, user agent, timestamp and
audit row). The contract only flips to `signed` once every `required` signer is
done; until then it stays `sent`.

- The roster is seeded by the `contracts_seed_signers` trigger from the couple's
  `primary_name`/`primary_email` and `secondary_name`/`secondary_email`.
- `/api/email/send-contract` emails **each client signer their own link**,
  de-duplicated by address.
- The supplier's countersignature is recorded at send time as a real vendor
  signer row with a genuine timestamp, IP and user agent. Previously
  `mc_signature_name` was just copied out of Settings with no evidence at all.
- `revoke_contract` clears every partial signature and reissues every
  `sign_token`, so one partner's signature cannot carry over onto re-issued
  wording and old links die.
- Reminders chase only signers who still owe a signature, on their own links.
- In the builder footer, **Copy link** opens a popover with the primary and secondary
  contact's own links (`lib/contracts/signer-links.ts`), on a draft too (with a note that
  they go live on send). A never-saved draft names the contacts and saves itself when the
  popover opens, since tokens are seeded on insert. A couple with no secondary contact shows that row greyed out with
  a tooltip. There is no **Open** for contracts: each link is one person's, and the MC
  opening it would log a `viewed` audit event in that person's name.
- When the last required signature lands, `sendContractSignedEmail` delivers a
  copy of the executed contract to every signer and the account holder.

**Token compatibility.** `_resolve_contract_token()` accepts either a
`contract_signers.sign_token` or a legacy `contracts.share_token`. A legacy link
signs the lowest-ordered outstanding client, so contracts already in flight
keep working.

- Public page: `/contract/[token]` (either token kind)
- Signer types full legal name + ticks "I agree" checkbox.
- Typed name is rendered in a cursive font as the signature (Australian Electronic Transactions Act 1999 allows typed-name signatures).
- Server route `/api/contract/sign` captures `x-forwarded-for` IP + `user-agent` before calling the `sign_contract()` RPC.
- Audit trail is shown on the public page after signing and stamped onto the PDF.

### Audit log (Phase 3.2)

Every state change writes a row to `public.contract_audit_log` —
the durable trail behind the fast-path snapshot in the `contracts`
columns. Triggered by these RPCs (each one calls
`emit_contract_audit_event(...)` internally):

| RPC | event_type | actor | Notes |
|---|---|---|---|
| `sign_contract` | `signed` | `couple` | Captures `actor_ip`, `actor_user_agent`, `signer_name_typed`. Written BEFORE status flip so a later revoke can't erase it. |
| `decline_contract` | `declined` | `couple` | Captures `decline_reason` + IP/UA. |
| `revoke_contract` | `revoked` | `mc` | Captures `revoked_from_status` so the trail records "this was sent then revoked" (signing is non-revocable — guarded server-side). |
| `expire_contracts` (cron) | `expired` | `system` | One row per contract the cron flips. |
| `mark_contract_reminder_sent` | `reminder_sent` | `system` | Captures `reminder_number` (1 or 2). |
| `/api/email/send-contract` (route) | `sent` | `mc` | Written on the locking step (status → 'sent'). |

`'viewed'` is written by `record_contract_view(token, ip, ua)`, called from
`/api/contract/view` when the public page loads. It logs **once per signer**
(matched on `signer_name_typed`), so refreshing does not flood the trail, and
only for a live, non-revoked contract. This is the "opened on" evidence that
matters when a signatory later says they never saw the terms.

**Unresolved variables:** `{{mc_*}}` ids keep the historical prefix because the
ids are stored inside saved template JSON and renaming them would break every
existing template. The user-facing labels ("Your ABN", "Your phone") carry no
role wording.

### Public-route hardening (Phase 3.2)

`/api/contract/sign` and `/api/contract/decline`:
- Zod-validated body (`token: z.uuid()`, name length-bounded with no regex — international names like O'Brien / Anh Nguyễn must pass).
- 3 / min / IP rate-limit via `inMemoryLimiter` (signing is one-shot; bursts are abuse).
- Structured logger; sanitised error responses (no DB-internal leakage).
- `'contract'` added to the `PublicSurface` union on `public-token-limiter`.

`/api/email/send-contract` (MC-side, authenticated):
- Zod-validated `{ contractId: z.uuid() }`.
- 10 / min / IP rate-limit (looser — MCs do send batches).
- Calls `emit_contract_audit_event` directly to log the 'sent' event when locking the contract.

## Supplier countersignature

- The typed `mc_signature_name` is set once in Settings → Personal Info.
- At send time it is snapshotted into `contracts.mc_signature_name` (so later
  changes don't retroactively alter a signed document) **and** recorded as a
  signed `contract_signers` row with `role = 'vendor'`, capturing the real
  timestamp, IP and user agent of the authenticated send.

## Invoices on signing

Nothing is created. `quotes` and `proposals` were both removed, and
`sign_contract` now only records the signature, advances the couple to
`confirmed`, and raises a follow-up task. Invoices are fully manual.

## Reminders & expiry

- Day-3 + day-7 reminder emails, capped at 2 reminders total (`reminder_count` column).
- Nightly Vercel cron hits `/api/email/send-contract-reminders` + `/api/cron/expire-contracts` (auth via `CRON_SECRET`).

## Plan gating

Historically gated behind a `hasContractsAccess()` helper. **That helper no
longer exists** and the send endpoint does not plan-gate: access is governed by
the general subscription checks in `lib/auth/entitlements.ts` (`isSubscribed`,
`currentPlan`) applied at the route/middleware level. Re-verify before relying
on contracts being Pro-only.

## Related files

- `supabase/migrations/20260421000000_add_contracts_feature.sql`  -  schema + RPCs
- `supabase/migrations/20260828000000_fix_contract_money_merge_fields.sql`
- `supabase/migrations/20260828001000_contract_vendor_role.sql`
- `supabase/migrations/20260828002000_user_branding_vendor_role.sql`
- `supabase/migrations/20260828003000_create_contract_signers.sql`
- `supabase/migrations/20260828004000_contract_signers_rpcs.sql`
- `supabase/migrations/20260828005000_contract_viewed_event.sql`
- `supabase/migrations/20260828006000_contract_title_optional.sql`
- `supabase/migrations/20260828007000_contract_header_owns_title.sql`
- `supabase/migrations/20260828009000_contract_couple_full_names.sql`
- `lib/couples/display-name.ts`
- `lib/branding/vendor-role.ts`
- `app/contract/[token]/_components/contract-signers-list.tsx`
- `app/(dashboard)/contracts/contract-builder-modal.tsx`
- `app/(dashboard)/couples/couple-contracts.tsx`
- `app/(dashboard)/settings/contract-template-manager.tsx`
- `app/contract/[token]/page.tsx`  -  public sign page
- `app/api/email/send-contract/route.ts`
- `app/api/contract/sign/route.ts`
- `app/api/contract/view/route.ts`
- `app/api/contract/decline/route.ts`
- `app/api/cron/expire-contracts/route.ts`
- `app/api/email/send-contract-reminders/route.ts`
- `app/portal/[token]/contracts-section.tsx`
- `components/ui/rich-text-editor.tsx`
- `lib/contract-variables.ts`
- `lib/auth/entitlements.ts` (`hasContractsAccess`)
- `lib/generate-pdf.ts` (`'contract'` branch)
- `vercel.json`  -  cron schedules
