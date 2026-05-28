# Zebri production smoke-test checklist

Run through this against the live URL after `staging → main` promotion.
Estimated time: **30-45 minutes** end to end.

Use **two browser profiles**: one signed in as an MC vendor account
(your test account), one **incognito** for the couple-side public
surfaces. Some flows need both open in parallel.

---

## 0. Pre-flight

- [ ] Open the **Vercel deployment dashboard**. Confirm the latest
      `main` deploy succeeded; no failed checks; no error spikes in
      Slack.
- [ ] Open the **Supabase project** in another tab. SQL editor ready
      in case you need to inspect a row.
- [ ] Open the **Slack alerts channel**. Watch for alerts during the
      run; everything should be quiet except expected `contract_signed`
      / `invoice_paid` events.

---

## 1. Auth + account

- [ ] Hit the **landing page** — loads, no console errors.
- [ ] Click **Sign in** — login form renders.
- [ ] Try **wrong password** — error message shown, no infinite spin.
- [ ] Sign in with the test account — lands on `/couples`.
- [ ] Click **Settings → Billing** — current plan visible, "Manage
      subscription" button present.
- [ ] Click **Settings → Profile** — business name, contact info
      editable; save works.
- [ ] **Sign out** — redirects to landing page.
- [ ] **Reset password flow** (use a disposable email if needed):
      submit → check inbox → reset link → set new password → log in
      with it.
- [ ] **Sign up flow** with a fresh email — confirmation email
      arrives, account created, lands on dashboard.

---

## 2. Couples list + kanban

- [ ] `/couples` loads in **kanban view** by default.
- [ ] Drag a couple card from one status column to another — moves
      visibly, persists on reload.
- [ ] Select a card, **shift-click another card** — range select
      highlights both.
- [ ] **Bulk action bar** appears with count.
- [ ] **Bulk status change** — change selected couples to another
      status; verify persistence.
- [ ] **Esc** clears multi-select.
- [ ] Switch to **List view** (`?view=list`) — table renders.
- [ ] **Search** for a couple by name — filters live.
- [ ] **Filter by status** — only matching rows shown.
- [ ] **Sort by event date** — order changes.
- [ ] Select some rows, click **Export CSV** — file downloads with
      the right columns.
- [ ] Press **"n"** anywhere on the page (not in an input) — Add
      Couple modal opens.
- [ ] Create a new test couple — appears in list + kanban.
- [ ] Open the couple's profile, then **edit the URL** to
      `/couples?openCouple=<id>` and reload — couple profile opens
      directly (deep-link works).

---

## 3. Couple Profile (the modal)

Open any couple's profile. Cycle through all 9 tabs:

- [ ] **Overview** — couple details visible; status pill click opens
      picker; status change persists.
- [ ] **Pulse** — recent activity / metrics render (or empty state).
- [ ] **Tasks** — add a task ("Test task"); status dropdown works;
      due-date picker works; delete works.
- [ ] **Contacts** — pick from existing vendors; add a new one inline;
      edit vendor details; remove a vendor.
- [ ] **Timeline** — pick an event; add a timeline item with start
      time; reorder via drag; share link is visible.
- [ ] **Songs** — add a song; rename a category; add a custom
      category; delete a song.
- [ ] **Files** — upload a PDF/JPG under 20 MB; preview link works;
      delete the file (removes from storage too).
- [ ] **Payments** — Quotes + Invoices subtabs both render.
- [ ] **Contracts** — list renders (gated on Pro+ plan).
- [ ] Click the **portal-link icon** in the header — "Couple portal
      link" + "Vendor link" copy buttons work; **Rotate links**
      invalidates old URLs.
- [ ] **Esc** closes the modal.
- [ ] **Mobile viewport** (resize to ≤ sm or use iPhone 12 in
      DevTools): header collapses to "⋯ Actions" menu; tabs scroll
      horizontally; modal fills viewport.

---

## 4. Events + calendar

- [ ] In Couple Profile → **Events tab** → "+ Add event" — modal
      opens; date + venue + status fields work; venue autocomplete
      suggests Places.
- [ ] Pre-select 2 vendors; save → event appears with vendor chips.
- [ ] If venue has lat/lng, an **auto-Sunset timeline item** appears
      after creation.
- [ ] Edit the event; change the date — reload to confirm persistence.
- [ ] Delete a test event.
- [ ] Navigate to `/calendar`.
- [ ] Switch between **Day / Week / Month views** — all render
      without errors.
- [ ] **Sidebar status filter** — toggle a status; matching couples
      disappear/reappear.
- [ ] Click an event card on the calendar — opens that couple's
      profile.
- [ ] Open `/events/<id>/timeline` directly — the day-grid timeline
      renders.

---

## 5. Quotes (full lifecycle)

- [ ] `/payments` → **Quotes** tab → "New quote".
- [ ] Select a couple, add 2 line items with descriptions + amounts.
- [ ] Toggle **"+ Apply 10% GST"** → GST line appears in totals.
- [ ] Toggle **"+ Add discount"** → 10% percentage → totals update.
- [ ] Set an expiry date.
- [ ] Click **"Save changes"** → quote saved as draft.
- [ ] Verify **share link** is visible in the footer immediately —
      click "Open" to view the public page in incognito.
- [ ] Click **"Send to couple"** → email fires; button flips to
      "Resend" with timestamp.
- [ ] In incognito, open the share link — public quote renders with
      your branding.
- [ ] Click **Accept** → quote status flips; reload MC view to
      confirm.
- [ ] Create another quote, click **Decline** in incognito — same.
- [ ] Try opening an expired/revoked share link — "Quote unavailable"
      card shows (not an error page).

---

## 6. Invoices (with payment schedule)

- [ ] `/payments` → **Invoices** tab → "New invoice".
- [ ] Select a couple, add 2 line items.
- [ ] Configure a **payment schedule**: 30% deposit due in 30 days,
      70% final due 14 days before event.
- [ ] Save → invoice saved as draft.
- [ ] Send → "Sent {date}" timestamp appears.
- [ ] In incognito, open the share link → public invoice renders.
- [ ] Click **"Mark deposit paid"** on the MC side → timeline dot
      fills; status flips to **"Deposit paid"**.
- [ ] Click **"Mark final paid"** → timeline complete; status flips
      to **"Paid"**; header CTA disappears.
- [ ] **Overflow menu** → "Revert to sent" → confirm the revert path
      works.

---

## 7. Stripe Connect (if you have a Connect-enabled test account)

- [ ] **Settings → Payments** → if not yet connected, click **"Connect
      Stripe"**.
- [ ] Onboarding components render inside Zebri (embedded — no jump
      to Stripe).
- [ ] Complete the test-mode onboarding flow.
- [ ] After return, status panel shows charges + payouts enabled.
- [ ] Create a test invoice, send it.
- [ ] In incognito, open the share link → **"Pay with card"** button
      appears.
- [ ] Use Stripe **test card** `4242 4242 4242 4242`, any future
      expiry, any CVC → payment succeeds.
- [ ] On the success page, the invoice status updates to **Paid**.
- [ ] On the MC side, payment is reflected on the invoice.
- [ ] **Settings → Payments → Disconnect** → status flips to
      disconnected; "Pay with card" stops showing on public invoices.

---

## 8. Contracts (Pro+ plan only)

- [ ] `/payments` → **Contracts** tab → "New contract".
- [ ] Link to an accepted quote.
- [ ] Edit the contract body in the rich-text editor.
- [ ] Set an expiry date.
- [ ] Save as draft, verify the share link is live.
- [ ] Click **"Send to couple"** → email fires.
- [ ] In incognito, open the share link → public contract page
      renders with the locked content.
- [ ] **MC countersignature** shown (your typed name in cursive
      Caveat font).
- [ ] Type the signer name, check **"I intend my typed name as my
      legal signature"**, click **Sign contract**.
- [ ] Status flips to **Signed**; "Download PDF" button appears.
- [ ] Click **Download PDF** → PDF generates with signer name, IP,
      timestamp stamped.
- [ ] On the MC side, reload — status shows **Signed**; if quote was
      linked, a **deposit invoice draft** auto-created.
- [ ] Create another test contract, **Decline** it from incognito
      with an optional reason → status flips to **Declined**.
- [ ] **Revoke** a sent (but not signed) contract from the MC side →
      status reverts; verify audit log in Supabase
      (`select * from contract_audit_log where contract_id = '<id>'`).

---

## 9. Public surfaces (rate-limit check)

In incognito, hit each of these with a **garbage token** several
times in a row. Each should render the same "unavailable" card with
no error message hinting at the real state:

- [ ] `/quote/00000000-0000-0000-0000-000000000000`
- [ ] `/invoice/00000000-0000-0000-0000-000000000000`
- [ ] `/contract/00000000-0000-0000-0000-000000000000`
- [ ] `/portal/00000000-0000-0000-0000-000000000000`

After 60+ rapid invalid attempts to any of these, Slack should
receive a **`public_token_attempt_burst`** alert.

---

## 10. Couple portal (`/portal/<token>`)

In incognito, open a real `couple-portal` link copied from a couple
profile:

- [ ] Portal renders with your branding (colors, logo, fonts).
- [ ] **Names section** → bridal party + family render correctly.
- [ ] **Songs section** → song categories + tracks render.
- [ ] **Contacts section** → vendor list visible.
- [ ] **Files section** → uploaded files downloadable.
- [ ] **Timeline section** → if an event is linked, the day's
      timeline renders.
- [ ] Try the **vendor portal** link → restricted vendor view
      renders (subset of sections).

---

## 11. Settings + branding

- [ ] **Settings → Branding** → upload a logo, change brand color,
      pick a font, change density. Save.
- [ ] Open a public quote/invoice link → branding reflects the
      changes.
- [ ] **Settings → Templates → Contract templates** → edit one; save;
      create a new contract → template visible in the picker.
- [ ] **Settings → Templates → Timeline templates** → same flow with
      a timeline template; apply to an event.
- [ ] **Settings → Templates → Quote templates** → same flow.

---

## 12. Subscription management

If your test account is on a paid plan:

- [ ] **Settings → Billing** → current plan + status visible.
- [ ] **Upgrade** or **downgrade** between Pro and Max → Stripe
      Checkout or Customer Portal flow runs to completion.
- [ ] After upgrade, the entitlement reflects immediately
      (e.g. Contracts tab now visible if you went Starter → Pro).
- [ ] **Cancel subscription** → status flips to `cancelled`; the
      subscription stays active until period-end.

If on Starter:

- [ ] Add the 11th couple → **Starter cap lock modal** appears;
      "Upgrade" button routes to billing.

---

## 13. Webhooks + cron (smoke only)

These are mostly invisible but worth confirming nothing is firing
alerts:

- [ ] In Stripe dashboard → recent webhook deliveries to
      `/api/stripe/webhook` → all `200`.
- [ ] In Stripe dashboard → recent webhook deliveries to
      `/api/stripe/connect-webhook` (if Connect-active) → all `200`.
- [ ] In Vercel cron logs (or wait for nightly tick) → contract
      reminders + expiry crons completed without alert.
- [ ] No `app_error`, `cron_job_failed`, or `resend_send_failed`
      alerts in Slack during the run.

---

## 14. Mobile pass (Pixel 5 + iPhone 12 viewports)

In DevTools, set viewport to **iPhone 12** and run through the high-
risk surfaces:

- [ ] `/couples` — kanban scrolls horizontally; profile modal fills
      viewport.
- [ ] Couple Profile → all tabs reachable via horizontal scroll bar.
- [ ] Builder modals (quote/invoice/contract) — fields stack
      vertically; "Send to couple" CTA visible above the fold.
- [ ] Public quote/invoice/contract/portal pages — branded card
      renders; CTAs reachable; no horizontal scroll.

---

## 15. Roll-back signal

After the smoke pass, if **anything user-visible is broken** (status
not flipping, share links 500-ing, payment flow stuck, audit log not
recording):

1. Open Vercel → previous main deployment → **"Promote to
   production"**.
2. Post in the alerts channel: `Rolled back main to <previous SHA>`.
3. Re-test the exact surface that failed once the rollback is live.
4. File an issue with the failing test step + console/network output
   so the fix can land on staging first.

---

## Done?

If every box is ticked: this 134-commit promotion is live and clean.
Send the vendor update.

If anything is iffy but not blocking: list it under "known limitations"
in the vendor email and file follow-up issues on the appropriate
sub-phase branch.
