# Contracts end-to-end test

Manual run-through for the contracts audit remediation: multi-signer signing,
the `{{vendor_role}}` wording, tables, and the header-owns-the-title model.

Run this against **local** Supabase. The dev server normally points at the
remote project, which does not have these migrations until CI deploys them
(see the migration list at the bottom).

## 0. Setup

**Stop your running `npm run dev` first.** Next holds a `.next` lock, so a
second instance fails.

Give yourself a local login. The demo account already has an active
subscription; it has never onboarded, so without the second field the welcome
wizard covers the UI and every click times out.

```bash
docker exec -i supabase_db_zebri-crm psql -U postgres -c "
update auth.users
   set encrypted_password = crypt('zebri-local-test', gen_salt('bf')),
       raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb)
         || jsonb_build_object('welcome_onboarded_at', now()::text)
 where email = 'demo@zebri.local';"
```

Start the app against local, with email sending off. The two keys come from
`npx supabase status` (the "Publishable" and "Secret" rows); they are local-only
values but are deliberately not written here, since GitHub push protection
flags them.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key from supabase status> \
SUPABASE_SERVICE_ROLE_KEY=<secret key from supabase status> \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
RESEND_API_KEY= \
npm run dev
```

`RESEND_API_KEY=` is deliberately empty so no real email reaches a real
address. Signing links come from the database instead.

Log in as `demo@zebri.local` / `zebri-local-test`.

## 1. Role wording

1. **Settings → Personal info** → Business Type → tick **DJ**, untick MC.
   Leave "What clients call you" blank.
2. Hover the info glyph beside "What clients call you". The tooltip should
   name your business and read "(the DJ)".
3. **Branding → Contract**: the header block shows **Contract**,
   `{{ Both partner names }}`, Ref and ABN.

## 2. Couple

**Couples → New**, with **both** partners filled in:

- Primary: `Alex Rivera`, `alex@example.test`
- Secondary: `Sam Rivera`, `sam@example.test`

Both emails matter: they are what proves each partner gets their own link.

## 3. Tables

**Payments → Contracts → New contract**, pick the couple, then in the body:

1. Click the **table icon**. It inserts a 3x3 with a header row directly, no
   menu.
2. Hover a cell. A `+` / `x` pill appears on the **row** (left edge) and on the
   **column** (top edge). Add and delete both ways.
3. Type a fee schedule and check the right-hand preview renders it.

## 4. The heading

Leave the title box **empty**. The preview should read:

```
Zebri
Contract                      <- from the Branding header block
Alex Rivera and Sam Rivera    <- both partners, in full
<body, starting at its first clause>
```

One heading only. No "Contract for Alex", no duplicate title from the body.

**Overflow → Download PDF**: same heading, table intact.

## 5. Each client signs

This is the defect that started the work: a couple could not each sign.

1. Before sending, the footer shows **Download PDF** and **Copy link**. Copy
   link lists Alex and Sam with a note that the links go live on send: a
   draft has no body for the couple, so until then the public page answers
   "Contract unavailable". There is no Open.
2. Click **Send to couple**.
   **Expect "Failed to send contract".** That is correct with
   `RESEND_API_KEY=` empty: the contract is genuinely sent (status flipped,
   links live), only the email transport failed.
3. Reopen the contract. **Copy link** gives a link each for Alex (primary) and
   Sam (secondary), now without the note. On a couple with no secondary
   contact that row is greyed out; hover it for the reason. Or pull the links
   from the database:

```bash
docker exec -i supabase_db_zebri-crm psql -U postgres -c "
select s.name, s.role,
       'http://localhost:3000/contract/' || s.sign_token as link
  from contract_signers s
  join contracts c on c.id = s.contract_id
 where c.status = 'sent'
 order by c.created_at desc, s.signing_order;"
```

4. Open **Alex's** link in a normal window. A **Signatures** list names both
   partners, Alex marked "(you)". Sign it.
5. It should say *"Thanks, Alex. Your signature is recorded. The contract is
   complete once Sam Rivera has signed."* and the contract must still be
   **sent**, not signed.
6. Reload Alex's link and try again: refused.
7. Open **Sam's** link in a **different browser or private window** (the same
   window shares the session). Sign. Now it flips to **signed**.

## 5b. Revoke takes the links offline

With a contract sent and its links copied from step 5: open the contract in the
modal, choose **Revoke and edit**, then reload either partner's link. It must
show **"Contract unavailable"**, not a page with "No content." Send again and
the fresh links (re-run the query in step 5, the tokens are reissued) work.

## 6. MC-side progress

With one partner signed:

- **Payments → Contracts**: the Signed column reads `1 of 2`
- **Couple → Contracts tab**: `CTR-00x - Waiting on 1 of 2`
- Open the contract: a signature roster with a tick and a clock

## 7. Audit trail

```bash
docker exec -i supabase_db_zebri-crm psql -U postgres -c "
select event_type, actor, signer_name_typed, actor_ip, event_at
  from contract_audit_log
 where contract_id = (select id from contracts order by created_at desc limit 1)
 order by event_at;"
```

Expect `sent`, one `viewed` **per signer** (refreshing the page must not add
more), and one `signed` per signer **with different IPs**. That per-signer
evidence is the ETA 1999 identification gap the audit flagged.

## 8. Templates

**Templates → Contracts → New template**:

- The modal title reads **"Add contract template"** (not "Edit"), and is wide.
- **Cancel**: no row appears in the list. Clicking New no longer inserts one.
- Create one containing a table, save, and confirm the read-only preview shows
  table borders and header shading.

## Teardown

Ctrl-C and restart your normal `npm run dev`; it returns to remote Supabase,
where none of this exists until the migrations deploy.

## Migrations this depends on

```
20260828000000_fix_contract_money_merge_fields
20260828001000_contract_vendor_role
20260828002000_user_branding_vendor_role
20260828003000_create_contract_signers
20260828004000_contract_signers_rpcs
20260828005000_contract_viewed_event
20260828006000_contract_title_optional
20260828007000_contract_header_owns_title
20260828009000_contract_couple_full_names
20260828010000_revoke_disables_link
20260828011000_contract_link_requires_send
```

## Known, not covered here

- No Playwright e2e for the signing flow yet.
- The migrations have not been replayed from zero (`supabase db reset`).
- The contract template wording needs a lawyer: cancellation and deposit
  clauses are the usual ACL unfair-contract-terms exposure.
