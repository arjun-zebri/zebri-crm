# Contracts (e-sign)

Zebri includes a minimal, legally-valid e-signature flow so MCs can send service agreements, have the couple sign them, and automatically spawn the deposit invoice  -  without leaving the CRM.

## Status lifecycle

```
draft ──send──▶ sent ──sign──▶ signed
                 │  ──decline──▶ declined
                 │  ──expiry──▶ expired
                 └──revoke──▶ draft (new version, new token)
```

- **draft**  -  content is editable; no public link.
- **sent**  -  content is locked (`locked_content_html` is the frozen, variable-substituted snapshot). Public link active.
- **signed**  -  immutable. Audit trail is populated (`signer_name`, `signer_ip`, `signer_user_agent`, `signed_at`). Deposit invoice auto-created if a quote is linked.
- **declined**  -  terminal; `declined_reason` optional.
- **expired**  -  flipped nightly by `expire_contracts()` cron.
- **revoked**  -  old link is dead; status resets to `draft`, `version` bumps.

## Content authoring

Contracts are authored with TipTap (StarterKit + Mention). Variables are inserted as Mention nodes and are substituted at **send time**:

| Token | Source |
|---|---|
| `{{couple_name}}` | `couples.name` |
| `{{couple_email}}` | `couples.email` |
| `{{event_date}}` | earliest `events.date` |
| `{{venue}}` | earliest `events.venue` |
| `{{total_amount}}` | linked quote total |
| `{{deposit_amount}}` | linked quote total × `default_deposit_percent` (default 25%) |
| `{{mc_business_name}}` | `auth.users.raw_user_meta_data.business_name` |
| `{{mc_signature_name}}` | `raw_user_meta_data.mc_signature_name` |
| `{{today}}` | date sent |

See `lib/contract-variables.ts` for the catalog and rendering helpers.

## Signing

- Public page: `/contract/[token]`
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

The `'viewed'` event_type is reserved for future use (we don't
currently log public-page renders).

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

## MC countersignature

- Automatic. MC sets their typed `mc_signature_name` in Settings → Personal Info once.
- At send time, this name is snapshotted into `contracts.mc_signature_name` so later changes don't retroactively alter a signed document.

## Linked quote → deposit invoice

When a contract with a linked (accepted) quote is signed, `sign_contract()` inserts:
1. A new `invoices` row with `status='draft'`, `subtotal` and items copied from the quote, and `deposit_percent` from `raw_user_meta_data.default_deposit_percent` (fallback 25%).
2. A follow-up task: "Contract signed by X  -  review & send deposit invoice".

The invoice is created as a draft so the MC can review before sending.

## Reminders & expiry

- Day-3 + day-7 reminder emails, capped at 2 reminders total (`reminder_count` column).
- Nightly Vercel cron hits `/api/email/send-contract-reminders` + `/api/cron/expire-contracts` (auth via `CRON_SECRET`).

## Plan gating

Contracts are a **Pro-plan** feature. `lib/subscription.ts` exposes `hasContractsAccess(userMeta)`. The Couple Profile tab, `/payments` Contracts tab, and send endpoint all gate on it.

## Related files

- `supabase/migrations/20260421000000_add_contracts_feature.sql`  -  schema + RPCs
- `app/(dashboard)/contracts/contract-builder-modal.tsx`
- `app/(dashboard)/couples/couple-contracts.tsx`
- `app/(dashboard)/settings/contract-template-manager.tsx`
- `app/contract/[token]/page.tsx`  -  public sign page
- `app/api/email/send-contract/route.ts`
- `app/api/contract/sign/route.ts`
- `app/api/contract/decline/route.ts`
- `app/api/cron/expire-contracts/route.ts`
- `app/api/email/send-contract-reminders/route.ts`
- `app/portal/[token]/contracts-section.tsx`
- `components/ui/rich-text-editor.tsx`
- `lib/contract-variables.ts`
- `lib/subscription.ts`
- `lib/generate-pdf.ts` (`'contract'` branch)
- `vercel.json`  -  cron schedules
