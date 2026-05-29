# What's new in Zebri

Hi! A big batch of updates just shipped to Zebri. Nothing about how you
work day-to-day changes — but a lot got faster, safer, and more
flexible. Here's what's worth knowing.

---

## You can now accept card payments

The biggest new thing. Couples can pay your invoices by card on the
public invoice link — no bank-transfer round-trip, no waiting.

- Connect your Stripe account from **Settings → Payments**. The setup
  happens inside Zebri (no jumping out to Stripe's website).
- Once connected, your invoices show a **"Pay with card"** button.
- Funds land in your nominated bank account on Stripe's standard
  payout schedule.
- A small Stripe fee applies per transaction; you'll see it on the
  Stripe side.

Bank transfer + "Mark as paid" still work exactly as before — Connect
is opt-in.

---

## Contracts now have a full audit trail

Every contract you send is backed by a tamper-proof history log.
Every event — sent, viewed, signed, declined, revoked, reminded — is
recorded separately with timestamp, IP address, and user-agent.

If a couple ever disputes a signature, you can pull the trail and
show exactly when they signed and from where. The trail survives
revocations: signing → revoking → resigning leaves every step on
the record.

---

## Share links are now live the moment you create a document

Previously, quote / invoice / contract share links only worked once
you'd hit "Send to couple." Now they're live from the moment the
document is created — you can copy and paste a draft link to your
couple without going through the email-send flow.

- Find the link under each builder modal's footer ("Share link · Copy · Open").
- Same security: anyone with the link can view; only the couple's
  email can act on it.

---

## Redesigned builder modals (Quotes, Invoices, Contracts)

The three "create a document" modals got a refresh:

- **Document-style layout** — hero title, clean items table, sticky
  totals panel. Feels more like a Stripe invoice editor than a CRM
  form.
- **Discount + GST toggles** — collapsed by default; click to add.
  No more wading through unused fields.
- **Payment schedule timeline (invoices)** — the deposit/final
  split now renders as a vertical timeline with paid/due dots and
  inline "Mark paid" actions.
- **Status-aware primary CTA** — header button changes contextually
  ("Mark paid" → "Mark deposit paid" → no button when paid).
- **Quote templates** — empty-state picker shows them prominently;
  apply one to seed a new quote in two clicks.
- **PDF / Email / Payment-page preview tabs** — see exactly how each
  document will look in every channel before you send it.

---

## Public payment + portal pages got a polish

The pages your couples actually see:

- **Public quote / invoice pages** — branded card with your colours,
  logo, font; "Accept / Decline" or "Pay with card / Mark deposit"
  actions inline.
- **Public contract page** — typed-name signature with live cursive
  preview + "I intend my typed name as my legal signature" checkbox.
- **Couple portal (`/portal/<token>`)** — bridal-party names, songs,
  files, timeline view, all branded.

If a couple opens a stale link (revoked or expired), they see a
clean "no longer available" card instead of an error.

---

## Calendar view (kanban → list → calendar)

The Couples page already had List and Kanban views. The standalone
`/calendar` route now has its own home with Day, Week, and Month
views, a sidebar status filter, and click-through to the couple
profile.

---

## Behind the scenes

A lot of work that you won't see directly but matters:

- **Tenant isolation tested end-to-end.** Every table that holds your
  data has an automated test proving another MC's account literally
  cannot read, edit, or delete your rows — even if they know the IDs.
- **Public links are rate-limited.** Burst attempts on share-token
  URLs from one IP get blocked + flagged (anti-enumeration).
- **All form inputs are server-validated.** Even if a browser tried
  to send a malformed value, the server rejects it before it touches
  the database.
- **In-app subscription management.** Upgrade, downgrade, cancel,
  reactivate — all from Settings → Billing without redirecting to
  Stripe.
- **Faster Couples + Events page.** Filter, sort, and bulk-select on
  the list page; multi-select drag on kanban.
- **Mobile polish across the app** — Couple Profile, builder modals,
  public pages all tested on Pixel 5 + iPhone 12 viewports.

---

## What hasn't changed

- Your existing couples, quotes, invoices, and contracts are
  untouched.
- Pricing tiers stay the same (Starter / Pro / Max).
- The Starter 10-couple limit still applies.
- Cron-driven reminders for contracts + invoices keep firing nightly.

---

## Anything to do?

Nothing required. If you want to enable card payments, head to
**Settings → Payments** and click **Connect Stripe**. Everything else
is automatic.

If you spot anything odd, reach out — we read every reply.
