e# Zebri smoke test plan

> Comprehensive manual sweep before promoting `staging` → `main`.
> Covers every page, every function, common and rare paths,
> desktop **and** mobile.
> Roughly 4–5 hours start to finish for a careful pass.

## Table of contents

- [0 · Pre-flight setup](#0--pre-flight-setup)
- [1 · Unauthenticated surfaces](#1--unauthenticated-surfaces)
- [2 · Dashboard](#2--dashboard-)
- [3 · Couples](#3--couples-couples)
- [4 · Calendar](#4--calendar-calendar)
- [5 · Tasks](#5--tasks-tasks)
- [6 · Contacts](#6--contacts-contacts)
- [7 · Payments](#7--payments-payments)
- [8 · Branding](#8--branding-branding)
- [9 · Settings](#9--settings-settings)
- [10 · Admin](#10--admin-admin--admin-account-only)
- [11 · Public surfaces](#11--public-surfaces)
- [12 · Email pipeline](#12--email-pipeline)
- [13 · Cron + alerts](#13--cron--alerts)
- [14 · Cross-cutting / global](#14--cross-cutting--global)
- [15 · Rare paths + edge cases](#15--rare-paths--edge-cases)
- [16 · Security spot checks](#16--security-spot-checks)
- [17 · Performance / scale](#17--performance--scale)
- [18 · Accessibility quick pass](#18--accessibility-quick-pass)
- [19 · Final end-to-end journeys](#19--final-end-to-end-journeys)

---

## 0 · Pre-flight setup

- [ ] Four test accounts ready:
  - **Admin** account (has `app_metadata.account_type = 'admin'`).
  - **Paying Pro** (or comped) account.
  - **Fresh Starter** account at the 5-couple cap. Add couples
    until you hit 5 if needed.
  - **Throwaway** account for delete-user + destructive tests.
- [ ] Staging URL open in **Chrome desktop** and **Chrome mobile
  emulator (iPhone 12)** in separate tabs. Real iPhone in hand
  for one pass at the end.
- [ ] `#zebri-alerts` Slack channel open.
- [ ] Test cards noted:
  - `4242 4242 4242 4242` — success.
  - `4000 0000 0000 0341` — declines.
  - `4000 0027 6000 3184` — requires 3DS authentication.
  - `4000 0000 0000 9995` — insufficient funds.
- [ ] Supabase Studio open in a tab so you can verify
  `admin_audit_log` rows + RLS behaviour.

---

## 1 · Unauthenticated surfaces

### 1.1 · Auth pages

- [y] `/login` — email + password fields, "Forgot password" link.
- [y] Wrong password → generic error toast, no nav.
- [y] Non-existent email → generic "auth failed" (must NOT leak
  "user not found").
- [y] Successful login → lands on `/`.
- [y] `/signup` — fields render, validation on empty submit.
- [y] Signup with existing email → graceful error.
- [y] Fresh signup → lands on Dashboard. **No 14-day trial,
  no countdown.** Account is Starter with 5-couple cap.
- [?] `/reset-password` (request) → success message + email
  arrives.
- [?] Click reset link → `/update-password` opens.
- [?] Set new password → toast + redirect to login.
- [y] **Rate limit**: try 6+ failed logins in a row → rate-limit
  message; check `auth_rate_limit_hit` alert in Slack.

### 1.2 · Middleware guards

- [y] Logged out: `/`, `/couples`, `/payments`, `/admin` all
  redirect to `/login`.
- [y] §7.4 probe: signed in as non-admin, run in dev console
  `await supabase.auth.updateUser({ data: { account_type: 'admin' } })`.
  Reload. **Admin link must NOT appear in the sidebar.** Visiting
  `/admin` directly must still redirect.

---

## 2 · Dashboard (`/`)

- [y] Loads, no console errors.
- [y] Period dropdown (Weekly / Monthly / Quarterly / Yearly)
  updates every card on change.
- [y] **Top row** — Leads / Conversion / Revenue. Numbers
  reasonable; diff colours: positive green, negative red.
- [y] **Revenue chart** — mint-green area renders. Hover tooltip
  shows AUD value.
- [y] Chart dropdown flips Revenue ↔ Leads.
- [y] **Calendar widget** — shows upcoming events. Click an event
  → couple profile slide-over opens.
- [y] **Leads card** — status bars render, counts add up.
- [y] **Lead Sources card** — sources listed with percentages.
- [y] **Outstanding Tasks card** — click a task → opens couple
  profile on Tasks tab.
- [y] **Outstanding Invoices card** — click → opens couple
  profile on Payments tab.
- [y] Empty states: every card shows "No X yet" not a crash.
- [y] **Mobile**: cards stack single-column. Period dropdown +
  Calendar widget remain usable.

---

## 3 · Couples (`/couples`)

### 3.1 · List / Kanban / Calendar views

- [y] Kanban default. Each card shows name + date + status.
- [y] Drag a couple between status columns → persists on reload.
- [y] Switch List view → table renders.
- [y] Switch Calendar view → mini-month sidebar + Day / Week /
  Month options.
- [y] Calendar **Day** view — 24-hour grid, events at correct
  times.
- [y] Calendar **Week** view (default) — 7-column grid.
- [y] Calendar **Month** view — 6-week grid.
- [y] Prev/Next nav buttons in Calendar header.
- [y] Status filters (sidebar checkboxes) hide/show statuses;
  black `accent-black` checkboxes.
- [y] Couple-name search in calendar sidebar filters live.

### 3.2 · Add couple

- [y] "Add couple" → modal opens with Name / Email / Phone /
  Status / Notes only. **No event date or venue field** (those
  live on Events tab).
- [y] Submit empty → validation errors.
- [y] Submit valid → modal closes, couple appears.
- [y] **Starter cap**: at 5 couples on Starter, trying to add a
  6th must fail with a clear "Upgrade to add more couples"
  message.

### 3.3 · Couple profile (slide-over)

Click any couple → profile opens. Test each tab:

- [y] **Overview** — events list + contacts inline (no separate
  sidebar). Edit Name / Email / Phone / Status / Notes → Save
  → toast → reopen → persists.
- [y] **Events** — add event (date + venue). Multiple events
  supported. Edit and delete an event.
- [y] **Contacts** — ContactPicker search → assign existing
  contact → appears in list. Remove a contact link.
- [y] **Tasks** — inline form creates task. Mark complete.
  Delete task.
- [y] **Payments** sub-tab — Quotes list, Invoices list. Open
  existing → builder modal opens with right data.
- [y] **Contracts** sub-tab — list. "New contract" opens builder.

---

## 4 · Calendar (`/calendar`)

- [ ] Loads, Week view default.
- [ ] Day / Week / Month switching works.
- [ ] **Mobile**: Day/Week usable; Month grid scrolls horizontally.

---

## 5 · Tasks (`/tasks`)

- [ ] Loads. Tasks grouped by group / status.
- [ ] Create a task group → appears.
- [ ] Create a task (title + due date) → appears in the group.
- [ ] Mark task complete → strikethrough / moves to completed.
- [ ] Drag-reorder tasks within a group → persists.
- [ ] Bulk-select multiple tasks → bulk delete works.
- [ ] Bulk-select → bulk status update (active / inactive).
- [ ] Delete a task group with tasks → confirmation modal →
  cascades.
- [ ] **Mobile**: drag-reorder is either reachable or replaced
  with a sensible alternative.

---

## 6 · Contacts (`/contacts`)

- [ ] Loads. Table with name / business / category / email /
  phone.
- [ ] Add contact (name, category enum: photographer /
  videographer / etc, email, phone) → save → appears.
- [ ] Edit a contact (inline or modal).
- [ ] Bulk-delete with confirmation.
- [ ] Bulk update status (active / inactive).
- [ ] Search filters work.
- [ ] **Mobile**: table scrolls horizontally; modals work.

---

## 7 · Payments (`/payments`)

### 7.1 · Tabs

- [ ] Quotes / Invoices / Contracts tabs switch correctly.
- [ ] Each tab list has appropriate columns + status badges.

### 7.2 · Quote builder

- [ ] "New quote" → modal opens with couple selector.
- [ ] Select couple → couple info appears.
- [ ] Add line items (description + amount).
- [ ] Apply 10% GST → tax line in totals.
- [ ] Add discount → discount line.
- [ ] Add notes.
- [ ] Save → quote persists, status = draft.
- [ ] Enable share link toggle → URL generated.
- [ ] "Send to couple" → email fires (check Slack/Resend),
  status → sent, button becomes "Resend" with "Sent {date}".
- [ ] Open share URL in incognito → public quote loads (see
  §11.1).
- [ ] **Empty quote** (no line items) → cannot send (button
  disabled or error).

### 7.3 · Invoice builder

- [ ] "New invoice" → modal.
- [ ] Configure 30/70 deposit + final → vertical timeline.
- [ ] Save + send.
- [ ] Mark deposit paid → timeline updates (filled dot, "Paid
  {date}").
- [ ] Mark final paid → status flips to Paid, CTA disappears.
- [ ] On paid invoice → ⋯ menu offers "Revert to sent" →
  reverts cleanly.

### 7.4 · Contract builder

- [ ] "New contract" → builder, templates available.
- [ ] Pick default template → contract body populates with 24
  clauses.
- [ ] Save + send → email fires.
- [ ] Couple signing flow → §11.4.

### 7.5 · Mobile

- [ ] Builder modals usable on iPhone 12. Line items
  single-column. Sticky footer reachable.

---

## 8 · Branding (`/branding`)

### 8.1 · Editor shell

- [ ] Loads. Loading skeleton uses tokens (no flash of grey).
- [ ] Surface tabs: Quote / Invoice / Contract / Portal.
- [ ] Left panel pickers: Brand / Accent / Surface / Text /
  Muted / Secondary / Secondary text colors.
- [ ] Upload Logo, favicon, header image.
- [ ] Font heading + body selectors. Font weight + scale.
- [ ] Density, corner radius, doc padding sliders.
- [ ] Theme presets reset fields.

### 8.2 · Block editor

- [ ] Add a block (Title / Tagline / Line items / Footer etc).
- [ ] Reorder via drag handle.
- [ ] Edit inline text.
- [ ] Delete a block.
- [ ] Apply Brand kit (if saved).
- [ ] Save as kit → kit appears in picker.

### 8.3 · Preview

- [ ] Preview pane updates live as colors / fonts change.
- [ ] Switch surface tab → blocks for that surface render.

### 8.4 · Persistence

- [ ] Save → reload → all selections persist.
- [ ] Open a public quote URL in incognito → branding reflected.

### 8.5 · Mobile

- [ ] Editor opens. Color/font controls reachable. Block editor
  may be desktop-first; just confirm it doesn't crash.

---

## 9 · Settings (`/settings`)

### 9.1 · Personal Info

- [ ] Display Name / Business Name / Phone / Website /
  Instagram / Facebook / Business Type / MC Signature Name /
  Address (with autocomplete).
- [ ] Edit field → save → reload → persists.
- [ ] Email change → triggers re-verification email.

### 9.2 · Account

- [ ] Email-preferences checkboxes (product updates / booking
  reminders / tips).
- [ ] Change password (current + new + confirm) → works.
- [ ] Delete-account button visible (don't click unless
  throwaway).

### 9.3 · Plans & Billing

- [ ] Current plan card shows active plan.
- [ ] **No trial copy anywhere** (Phase 1 removed trials).
- [ ] Plan comparison: Starter (free, 5-couple cap) / Pro $49 /
  Max $89.
- [ ] If Pro/Max:
  - [ ] "Manage in Stripe" opens Stripe customer portal.
  - [ ] Cancel subscription → confirmation → "Cancels on
    {date}".
  - [ ] Resume → reverts cancellation.
- [ ] If Starter:
  - [ ] "Upgrade to Pro" → Stripe Checkout.
  - [ ] Success card → returns active Pro.
  - [ ] Decline card → handled gracefully.
- [ ] Billing history with PDF / receipt links.

### 9.4 · Receive Payments

- [ ] Bank account fields (name / BSB / number) save.
- [ ] **Stripe Connect** card:
  - [ ] If not connected: "Connect Stripe" → onboarding flow
    → returns to Receive Payments with Connect enabled.
  - [ ] If connected: charges_enabled + payouts_enabled flags
    display.
  - [ ] "Disconnect" → confirmation.

### 9.5 · Templates

- [ ] Quote templates list → create / apply.
- [ ] Contract templates → same.
- [ ] Timeline templates → same.

### 9.6 · Statuses

- [ ] Custom couple-status list. Add (color + name) saves.
- [ ] Drag-reorder works.
- [ ] Delete (warn if couples are using it).

### 9.7 · Notifications

- [ ] Email-notification toggles. Save.

### 9.8 · Mobile

- [ ] Tabs scroll horizontally. All forms usable.

---

## 10 · Admin (`/admin`) — admin account only

### 10.1 · Dashboard tab (default)

- [ ] **No search bar on this tab** (moved to Users tab).
- [ ] **Row 1 — 4 chart cards** with 12-week sparklines:
  - [ ] **MRR** — $ value + diff badge + `$X Pro · $Y Max`
    detail. Sparkline renders.
  - [ ] **Active subs** — count + `N paying · X comped ·
    Y past-due` detail.
  - [ ] **Churn (last 30d)** — N lost + `X.X% rate` detail.
    **Inverted sentiment** — rising = red. Headline goes red
    at ≥5%.
  - [ ] **New signups** — count + `X this week` detail.
  - [ ] Hover each sparkline → tooltip shows week + value.
- [ ] **Row 2** — Upcoming renewals (next 7d, $30d total in
  header), Past-due, Connect issues. Each row → user detail
  panel.
- [ ] **Row 3** — Dormant accounts (>30d, zero couples), Recent
  signups.
- [ ] Verify **zero mentions of trials** anywhere.

### 10.2 · Users tab

- [ ] Switch to Users tab. **Inline search bar at top.**
- [ ] Type 2+ chars of an email → live filter, "X filtered from
  Y" indicator.
- [ ] Clear search → full list returns.
- [ ] Click any row → detail panel opens.

### 10.3 · User detail panel

- [ ] **Profile** — Display + Business name inputs. Save button
  ONLY appears when dirty.
- [ ] **Activity** — slim single-row stats + relative last
  sign-in.
- [ ] **Subscription** — clean property grid: Status, Plan,
  Renews/Access ends, Signed up, Stripe customer. **No Trial
  end. No Extend trial.**
- [ ] **Subscription actions**: [Plan select] [Comp user]
  [Cancel at period end].
  - [ ] Comp user → toast → becomes comped.
  - [ ] Cancel at period end → modal → confirm → toast.
- [ ] **Refund row** — $ input + Refund button. Disabled if no
  Stripe customer.
- [ ] **Link Stripe customer** — hidden behind underline link.
  Expands to input + Link + Cancel.
- [ ] **Account section** — Enter shadow + Send password reset.
- [ ] **Danger zone footer** — red label, separated by border.
  Delete user button only.

### 10.4 · Shadow mode

- [ ] Enter shadow on a test user → redirect to `/` as that
  user.
- [ ] **Shadow banner** at top with Exit button.
- [ ] Navigate Couples / Payments → seeing target's data.
- [ ] Slack alert `admin_shadow_entered` fires.
- [ ] `admin_audit_log` row written: action='enter_shadow'.
- [ ] Click Exit → back to `/admin` as admin.
- [ ] Subscription paywall bypassed during shadow even if
  shadowed user is unsubscribed.

### 10.5 · Audit trail spot checks

After running these actions, check `admin_audit_log`:

- [ ] Comp user → action='comp_user'.
- [ ] Cancel at period end → action='cancel_at_period_end'.
- [ ] Send password reset → action='send_password_reset'.
- [ ] Update profile → action='update_user_profile'.
- [ ] **Slack alerts fire ONLY for**: enter_shadow,
  delete_user, comp_user, refund_last_invoice. Others log but
  stay silent.

### 10.6 · Sidebar Admin link mobile

- [ ] iPhone 12 viewport: open mobile sidebar → scroll →
  **Admin link reachable** (recent fix).
- [ ] iPhone SE: same.
- [ ] With shadow banner active (40px lost): sidebar still
  scrolls to Admin.

---

## 11 · Public surfaces

### 11.1 · Public quote (`/quote/[token]`)

- [ ] Renders with branding (no raw greys).
- [ ] Couple name / line items / totals / GST / discount match.
- [ ] Accept → admin shows Accepted, couple → confirmed.
- [ ] Same URL again → "already accepted", Accept is no-op.
- [ ] Declined quote URL → declined state.
- [ ] Random UUID in URL → "not available" (no crash).
- [ ] Token disabled via admin → reload → "not available".

### 11.2 · Public invoice (`/invoice/[token]`)

- [ ] Renders with branding.
- [ ] With Connect: "Pay with card" → Stripe Checkout. Use
  `4242…` → success → redirect to `/invoice/payment-success`
  → invoice marked paid.
- [ ] Without Connect: bank details displayed (BSB + account
  from Receive Payments).
- [ ] Tamper with `session_id` in payment-success URL → page
  shows error / notFound. `payment_success_param_tampered`
  Slack alert fires.

### 11.3 · Public portal (`/portal/[token]`)

- [ ] Overview section + branding.
- [ ] Timeline section — items render, couple can mark "review".
- [ ] Contacts section — couple adds vendor contact → toast.
- [ ] Songs section — categories list, add song, drag-reorder.
- [ ] Payments section — invoices listed, pay button works
  (Connect).
- [ ] Contracts section — listed, view/sign opens contract
  surface.
- [ ] Files section — upload (under 100MB) → appears.
- [ ] Toggle off a portal section in /branding → reload public
  portal → that section is hidden.
- [ ] Disable share token → "not available".
- [ ] **Mobile**: portal navigation works.

### 11.4 · Public contract (`/contract/[token]`)

- [ ] Renders with branding + all 24 clauses.
- [ ] Type name → sign → status → Signed.
- [ ] Decline → reason input → submits.
- [ ] After signing: "Signed on {date}" displayed.
- [ ] On admin: contract shows signer name + IP + UA capture
  + audit-log row.

### 11.5 · Public timeline (`/timeline/[token]`)

- [ ] Renders with branding (Phase 10 tokens).
- [ ] Items render with time + description + assigned contact.
- [ ] MC contact footer (business name + email + phone).
- [ ] Invalid token → "no longer available".

---

## 12 · Email pipeline

For each, confirm delivery:

- [ ] Send quote → arrives with quote link.
- [ ] Send invoice → arrives with payment link.
- [ ] Send contract → arrives with sign link.
- [ ] Contract reminder cron — manually hit
  `/api/cron/expire-contracts` with `CRON_SECRET` bearer.
- [ ] Reset password → arrives.

---

## 13 · Cron + alerts

Check `#zebri-alerts` over a few hours of activity. Verify:

- [ ] `signup_completed` on new signup.
- [ ] `subscription_created` on payment.
- [ ] `payment_failed` with the decline card.
- [ ] `admin_shadow_entered` / `admin_user_comped` from tests.
- [ ] **No spam** — non-destructive admin actions (e.g.
  `send_password_reset`, `update_user_profile`) must be silent
  on Slack.

---

## 14 · Cross-cutting / global

### 14.1 · Theme

- [ ] If a dark theme is exposed (Settings), toggle. Every page
  adapts via CSS variables.
- [ ] Admin sparklines remain visible in both themes.

### 14.2 · Empty / loading / error states

For each major page:

- [ ] Hard-reload → loading skeleton renders correctly.
- [ ] Empty data → "No X yet" copy, no "undefined" leak.
- [ ] Offline (disconnect WiFi mid-request) → graceful error
  → reconnect → retry works.

### 14.3 · Mobile pass (real device)

- [ ] Login on phone.
- [ ] Hamburger / mobile sidebar opens.
- [ ] **Scroll to Admin link** if admin (recent fix).
- [ ] Each main page renders on iPhone width. No page-level
  horizontal scroll (table scroll within a card OK).
- [ ] Couple profile slide-over works full-width.
- [ ] Builder modals open + usable.
- [ ] Public portal — full couple flow on phone (this is the
  most realistic public scenario).
- [ ] Stripe Checkout on real mobile device.

### 14.4 · Browser compatibility

- [ ] Safari desktop — Recharts sparklines render on /admin.
- [ ] Safari iOS — same.
- [ ] Firefox — sanity check.

### 14.5 · Console hygiene

- [ ] Visit every page, open dev tools. **No red errors.**
- [ ] Warnings tolerable; flag anything ominous.

### 14.6 · No service-role leaks

- [ ] Network tab on every page → search payloads for
  `service_role` / `SUPABASE_SERVICE_ROLE_KEY` → zero matches.
- [ ] View-source on a few pages → no leaked keys.

---

## 15 · Rare paths + edge cases

### 15.1 · Auth edge cases

- [ ] Reset password link clicked after 1 hour → expired
  message, not a crash.
- [ ] Email change started, then user cancels via the
  re-verification email → original email unchanged.
- [ ] Sign out → sign in as a different user → cache /
  cookies cleared, no leak of prior user's data on Dashboard.
- [ ] Two browser tabs both signed in, sign out of one → other
  tab's next request redirects to login.

### 15.2 · Subscription edge cases

- [ ] **Upgrade Pro → Max**: from Billing tab → checkout flows
  → reload → plan = Max, MRR card reflects.
- [ ] **Downgrade Max → Pro**: same flow in reverse.
- [ ] **Past-due → recover with new card**: trigger past_due
  via decline card. Then update payment method in Stripe
  portal. Webhook fires → status returns to active.
- [ ] **Resume after cancellation**: cancel at period end →
  immediately Resume → cancel pulled.
- [ ] **Beta user vs paying user**: if you have a
  `is_beta_user: true` test account → MRR card EXCLUDES it
  (verify $ amount excludes their plan price).
- [ ] **Comped user**: same — MRR excludes.

### 15.3 · Stripe Connect edge cases

- [ ] **Disconnect Connect** → reload Receive Payments →
  status reflects.
- [ ] **Reconnect** → onboarding short-form, returns enabled.
- [ ] **Connect rejected** (Stripe sets `disabled_reason`):
  - [ ] Public invoice page falls back to bank-details flow.
  - [ ] Admin Dashboard "Connect issues" card lists the
    account.

### 15.4 · Couple edge cases

- [ ] **Bulk delete couples** (if exposed) — confirmation,
  cascade works.
- [ ] **Couple with very long name** (e.g. 60+ chars) →
  truncates with ellipsis in Kanban/List, full name in
  profile.
- [ ] **Couple with 30+ events** → list scrolls, no perf hit.
- [ ] **Concurrent edit**: open same couple in two tabs →
  edit + save in tab A → tab B reload → sees A's changes
  (no silent overwrite).
- [ ] **Starter cap regression**: at 5 couples, attempt 6th via
  the modal — error message appears.

### 15.5 · Quote / Invoice / Contract edge cases

- [ ] **Quote with 30+ line items** — renders without
  pagination crash; totals correct.
- [ ] **Quote sent → email bounces** → `resend_bounced` alert
  in Slack.
- [ ] **Invoice marked Paid → Reverted** → audit log captures
  both events.
- [ ] **Invoice past due_date with no payment** → status
  visible to admin.
- [ ] **Contract revoked + re-edited** — `contract_audit_log`
  has a row with action='revoked'. The original sign event
  survives (does not get cleared).
- [ ] **Contract expiry cron** — invoke
  `/api/cron/expire-contracts` → expired contracts flip to
  expired status.
- [ ] **Multiple contracts on same couple** — list renders
  with newest first.
- [ ] **Contract sent to wrong email** — admin can void +
  re-issue. Original token becomes invalid.

### 15.6 · Branding edge cases

- [ ] **Extreme colors**: brand = black, surface = white, text =
  black → public quote still readable.
- [ ] **No logo / no branding configured**: public quote uses
  documented defaults (`#A7F3D0` brand, `inter` font, etc.).
- [ ] **Very long business name** in branding header — wraps
  or truncates cleanly on public surfaces.
- [ ] **Brand kit with 5+ saved kits** — picker still usable.
- [ ] Switch active kit → reload → public surface reflects.
- [ ] **Upload logo > limit** (try a 50MB PNG) → rejected with
  clear error.

### 15.7 · Portal edge cases

- [ ] Toggle every portal section off in /branding → reload
  public portal → only "Overview" remains.
- [ ] **File upload exactly 100MB** → succeeds.
- [ ] **File upload 101MB+** → rejected at the cap.
- [ ] **Regenerate portal token** (if exposed) → old URL stops
  working immediately, new URL works.
- [ ] **Portal contact add** as the couple → entry lands in
  the MC's `contacts` table (verify in Supabase Studio).
- [ ] **Cross-couple probe** (manual): try the same portal
  token URL for another couple's portal — should not see
  their data (impossible by construction; sanity check).

### 15.8 · Admin destructive edge cases (use throwaway account)

- [ ] **Delete user** flow:
  - [ ] Confirmation modal → confirm.
  - [ ] Stripe subscription is cancelled.
  - [ ] Stripe customer is deleted.
  - [ ] `auth.users` row gone (verify in Studio).
  - [ ] Cascade removes their couples / events / invoices /
    contracts / quotes / tasks / contacts / portal data.
  - [ ] `admin_audit_log` row with action='delete_user',
    target_user_id is null (FK ON DELETE SET NULL), details
    includes the deleted email.
  - [ ] Slack `admin_user_deleted` alert (error severity)
    fires.
- [ ] **Refund last invoice**:
  - [ ] On a user with a recent paid invoice, enter
    `$X.YZ` amount → Refund.
  - [ ] Refund completes (toast).
  - [ ] `admin_audit_log` row with action='refund_last_invoice'
    + payment_intent_id + refund_id.
  - [ ] Slack `admin_refund_issued` alert.
  - [ ] Refund visible in Stripe customer dashboard.
- [ ] **Link Stripe customer** with the WRONG `cus_…` ID:
  - [ ] Validation rejects non-`cus_…` formats.
  - [ ] Real `cus_…` that doesn't exist → "Stripe customer is
    deleted" or similar error.

### 15.9 · Shadow mode edge cases

- [ ] Enter shadow → take an action as the shadowed user (e.g.
  send a quote). Check: action is attributed to the SHADOWED
  user in their data, NOT the admin. (RLS sees the shadow
  session as that user.)
- [ ] Enter shadow → close browser tab (don't click Exit) →
  reopen tab → session is still as shadow user; cookie has 24h
  TTL.
- [ ] Enter shadow on user A → exit → enter shadow on user B
  in quick succession → no stale-cookie crossover.
- [ ] Try to enter shadow on yourself (the admin user) →
  error "Cannot shadow yourself".
- [ ] Try to enter shadow on a user that doesn't exist → error.

### 15.10 · Calendar edge cases

- [ ] Calendar with an event spanning midnight (e.g. 22:00 →
  02:00 next day) — renders correctly across both days.
- [ ] Calendar with 5 events at the same time slot — they
  stack or overflow gracefully.
- [ ] Calendar empty week — empty state, no crash.

### 15.11 · Tasks edge cases

- [ ] Task with no due date → still creatable, sorts to the
  bottom.
- [ ] Task with due date in the past → flagged as overdue
  (red?).
- [ ] Delete a task while another tab has it open → other
  tab's optimistic update doesn't break.

### 15.12 · Email edge cases

- [ ] Send same quote 5 times in a minute — rate limit kicks
  in (`email_rate_limit_hit` alert).
- [ ] Resend bounce → `resend_bounced` alert.
- [ ] Send to a clearly-invalid email like `notanemail` →
  validation rejects before send.

---

## 16 · Security spot checks

### 16.1 · RLS / cross-tenant

- [ ] Open dev tools → Supabase client → try
  `from('couples').select('*').eq('user_id', '<another-user-uuid>')`
  → returns empty.
- [ ] Same for `quotes`, `invoices`, `contracts`, `contacts`,
  `tasks`, `portal_people`, `portal_songs`, `user_branding`,
  `timeline_items`, `timeline_templates`, `contract_templates`,
  `admin_audit_log`.

### 16.2 · §7.4 invariants

- [ ] In dev console: `await supabase.auth.updateUser({ data: {
  account_type: 'admin', subscription_status: 'active',
  subscription_plan: 'max', is_subscribed: true } })`.
- [ ] Reload. The user must remain a Starter, the Admin link
  remains hidden, and the paywall (if any) continues to block.

### 16.3 · Public-token brute-force

- [ ] In a script, generate 70 random UUIDs and request
  `/portal/<uuid>` for each → after 60 requests/hour the
  limiter trips, `public_token_attempt_burst` alert fires,
  remaining requests return notFound.
- [ ] Valid token requests must NOT count against the limit.

### 16.4 · Webhook signature

- [ ] Post to `/api/stripe/webhook` with a body that doesn't
  have a valid signature header → 400, no state changes,
  `stripe_webhook_failed` alert.
- [ ] Replay a real event (paste a webhook body that already
  ran) → idempotent (no duplicate row inserts).

### 16.5 · CRON_SECRET

- [ ] Hit `/api/cron/expire-contracts` without the bearer →
  401.
- [ ] With a wrong bearer → 401.
- [ ] With the correct bearer → 200, job runs.

---

## 17 · Performance / scale

For accounts with realistic data sizes:

- [ ] Account with 100 couples → Dashboard loads in < 2s.
- [ ] Couples Kanban with 100 cards → renders, drag stays
  smooth.
- [ ] Couples List view with 200+ rows → table virtualization
  works (no jank).
- [ ] Contacts page with 200+ contacts → search filter
  responsive.
- [ ] Quote/Invoice list with 30+ items → table scrolls
  smoothly.
- [ ] Admin Dashboard with 200+ users → MRR / churn / signups
  charts compute in < 3s; no obvious lag.
- [ ] Branding editor with 5+ block trees saved → switching
  surface tabs doesn't lag.

---

## 18 · Accessibility quick pass

- [ ] **Keyboard nav**: from `/`, press Tab through the page.
  Focus rings visible. Sidebar nav reachable. Couple cards
  focusable.
- [ ] **Enter / Space** activates focused controls.
- [ ] **Escape** closes modals + slide-overs.
- [ ] **Form labels** — every input has an associated `<label>`
  or `aria-label` (use accessibility tree in dev tools).
- [ ] **Color contrast** — body text on `bg-surface` passes
  WCAG AA (use Chrome dev tools' contrast picker).
- [ ] **Screen-reader spot check** — VoiceOver on macOS, read
  through Dashboard. Announcements make sense; no "button"
  with no label.

---

## 19 · Final end-to-end journeys

### 19.1 · Full customer journey (~15 min)

- [ ] Fresh signup → lands on Dashboard.
- [ ] Add 3 couples.
- [ ] Open couple #1 → add an event with date + venue.
- [ ] Create a quote on couple #1, add line items, send.
- [ ] Open couple #1's quote URL in incognito → accept.
- [ ] Back in admin: couple #1 status flipped to confirmed; a
  follow-up task was auto-created.
- [ ] Create an invoice on couple #1 with 30/70 schedule.
- [ ] Open invoice URL in incognito → pay deposit with
  `4242…`.
- [ ] In admin: deposit shows paid in the timeline.
- [ ] Create a contract on couple #1 → send.
- [ ] In incognito, sign the contract.
- [ ] Back in admin: contract is Signed, audit log has the
  signing event with IP capture.

### 19.2 · Support workflow (~10 min)

- [ ] Admin → Users tab → search a customer's email →
  detail panel opens.
- [ ] Enter shadow mode → look at their Couples / Payments
  → identify the issue.
- [ ] Exit shadow.
- [ ] In their detail panel: refund their last invoice ($X).
- [ ] Check `admin_audit_log` has all three rows
  (enter_shadow / exit_shadow / refund_last_invoice).
- [ ] Check Slack: `admin_shadow_entered` +
  `admin_refund_issued` alerts fired,
  `send_password_reset`-style routine actions did NOT.

### 19.3 · Subscription lifecycle (~10 min)

- [ ] Starter account → upgrade to Pro with `4242…` → active
  → reload, sees Pro.
- [ ] Upgrade to Max → active → reload, sees Max.
- [ ] Cancel at period end → "Cancels on {date}" → reload,
  same.
- [ ] Resume → cancel pulled.
- [ ] Manually switch to a declining card via Stripe portal →
  webhook fires past_due → admin sees Past-due card row.
- [ ] Update card back to working in Stripe portal → webhook
  → returns to active.

---

## How to use this

Roughly **210+ line items**. Suggested cadence:

| Pass | Sections | Time |
|---|---|---|
| 1 | 1, 2, 10 (auth + Dashboard + Admin) | 40 min |
| 2 | 3–9 (authenticated MC product) | 90 min |
| 3 | 11 (public surfaces in incognito) | 30 min |
| 4 | 14, 16 (cross-cutting + security) | 30 min |
| 5 | 15 (rare paths — use throwaway account) | 60 min |
| 6 | 17, 18 (perf + a11y) | 20 min |
| 7 | 19 (end-to-end journeys) | 35 min |

**Total ~5 hours** for a careful pass with rare paths.

A faster sanity pass (skipping 15, 17, 18) takes about
**2.5 hours** and still covers every page + every common
function on desktop + mobile.

Update this file when new features land. Tick boxes as you go —
the file lives in the repo so your progress survives session
restarts.
