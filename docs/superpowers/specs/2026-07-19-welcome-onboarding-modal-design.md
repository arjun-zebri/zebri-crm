# Welcome onboarding modal

**Date:** 2026-07-19
**Status:** Design approved, not yet implemented

## Purpose

New MCs sign up and land on an empty dashboard with no idea what Zebri
does. This is an eight-step modal, shown once on first login, that fills
the profile gaps signup left and shows the user the core loop of the
product through short animated previews.

It is weighted toward activation: collect the small amount of data that
is genuinely missing, then show what the product does, then get out of
the way.

## Scope

**In scope:** a single client-side modal, its eight steps, four bespoke
animated preview components, and a `user_metadata` flag that stops it
reappearing.

**Explicitly out of scope:**

- Branding setup. The existing wizard at
  `app/(dashboard)/branding/onboarding/` owns that and is not touched
  or referenced by this flow.
- Any setup checklist or dashboard card. Considered and dropped. After
  the modal the user is on their own.
- Creating any real records. Steps 4-7 are watch-only.
- Any re-entry point. The modal is shown once.

## The eight steps

| # | Step | Kind |
|---|------|------|
| 1 | Welcome to Zebri | Copy only |
| 2 | Your details | Form, saves |
| 3 | Your links | Form, saves |
| 4 | Add a couple | Animated preview |
| 5 | Create a template | Animated preview |
| 6 | Send it to your couple | Animated preview |
| 7 | Automate it | Animated preview |
| 8 | A note from the founder | Copy, finishes |

### Step 1: Welcome

A title and one or two sentences on what Zebri is. No inputs.

### Step 2: Your details

Three fields arrive prefilled from signup (`app/(auth)/actions.ts:145`
collects display name and business name; email comes from the auth
user):

- Name (prefilled from `display_name`, editable)
- Email (prefilled from the auth user, **read-only**)
- Business name (prefilled from `business_name`, editable)

Name and business name stay editable because business name appears on
every proposal and invoice, and a typo made at signup should be fixable
here rather than requiring a trip to Settings.

Email is read-only, with a note pointing at Settings. Changing it
triggers Supabase's confirmation-email round-trip
(`personal-info-section.tsx:207`), so an editable field would appear to
work and then quietly not take effect until the user clicked a link in
their inbox. That is worse than no field.

Plus the remaining identity fields from Settings → Personal info
(`app/(dashboard)/settings/personal-info-section.tsx`):

- Phone
- Address
- Signature name (`mc_signature_name`)

All fields are optional.

### Step 3: Your links

The remaining Personal info fields:

- Website
- Instagram URL
- Facebook URL

All optional. **Clicking Next on this step saves both step 2 and step
3 to `user_metadata`**, eight fields in total: the two editable
prefilled ones plus the six new. The split into two steps exists so neither
screen becomes a dense nine-field form; the save is deliberately at the
end of the pair so a user who drops out at step 4 still keeps
everything they typed.

### Steps 4-7: Previews

Each step shows a short animated caricature of a real Zebri flow, plus
a heading and a line of copy. Nothing is created, no network call is
made, and there are no failure states.

Each preview begins with a click on the sidebar, so the user learns
where the feature lives, not just what it looks like.

| Step | Beats |
|------|-------|
| Add a couple | Sidebar → Couples · New couple · Add manually · name and wedding date type in · Save · a couple row settles into the list |
| Create a template | Sidebar → Templates · New template · name, subject with a `{{couple.name}}` variable chip, body fills · Save |
| Send it | Sidebar → Couples · open the couple · Emails tab · Send email · pick the template from step 5 · Send · a "Sent" row drops into history |
| Automate it | Sidebar → Automations · New automation · trigger card fills with "New enquiry" · connector draws down · action node fills with "Send email" · status toggles on |

The four sequences chain deliberately: the couple created in step 4 is
the couple emailed in step 6, and the template written in step 5 is the
one sent and then automated. The user should read it as one story.

**Duration.** Roughly eight to ten seconds each. Five was the original
target but does not survive the added sidebar navigation. Step 6 has
six beats, and at five seconds each beat reads as a flicker rather than
a demonstration.

**Playback.** A preview starts when its step becomes active and rests
on its final frame. No looping: a loop behind a Next button competes
with the button. Navigating Back and returning replays from the start.

### Step 8: A note from the founder

Title: "A note from the founder". Layout makes room for a photo
placeholder, a sample note body, a name (Arjun Punekar) and a signature
placeholder.

The body copy is a placeholder for now. **This must not ship to real
users as placeholder text**, so either real copy lands before release or
the step stays behind a flag.

## Preview fidelity

The previews are hand-built mock components, not recordings and not the
real components rendered in a sandbox.

**Why mocks.** Rendering the real components would be accurate by
construction, but `couple-modal.tsx`, the template editor, the send
modal and the automation builder all fetch data, call Supabase and hold
their own state. Each would need a demo mode threaded through it, and a
refactor to any of them could break onboarding at runtime. Mocks are
insulated: a change to a production component cannot break the modal.

**The cost of mocks** is drift, and the mitigation is a standard, not a
mechanism: each preview is built and reviewed side by side against the
real screen in the running app, not from memory. The bar is that a user
who later opens the real screen recognises it immediately.

**Fidelity rule: real labels, fake data.** Step 7 shows "New enquiry"
and "Send email" because those are the actual strings in
`types/automations.ts:45` and `lib/automations/actions/ui.ts:39`. Names,
dates and email content are invented.

**Shared chassis.** All four sequences run inside one `PreviewFrame`
component: a miniature Zebri window with the sidebar rail on the left
and a content area on the right. Four scripts, one frame. This is less
work than four independent mocks and makes the set read as one system.

## Layout and chrome

**Container.** The shared `Modal` primitive at `size="xl"`
(`max-w-3xl`), matching the branding wizard's width. Fixed height around
`h-[680px]` so the frame does not jump between a form step and a preview
step. Single column, because the branding wizard's two-pane shell exists to
hold a live preview, and here the preview is the step content. Content
scrolls, footer is sticky.

**Progress.** A thin progress bar with a quiet "3 of 8" beside it, in
the manner of `components/questionnaires/typeform-flow.tsx:95`. The
branding wizard's numbered circles with labels work at three steps and
break down at eight, particularly on a Pixel 5.

**Footer.** Back on the left, hidden on step 1. Next on the right,
becoming Finish on step 8. Skip appears on steps 2 and 3 only; there is
nothing to skip on a preview step, so on 4-8 the secondary slot is empty
and Next carries the screen alone.

**Mobile.** Full width, viewport height rather than a fixed pixel
height. The previews are the risk: a caricature of the automation canvas
at 393px can turn to mush, so step 7 needs a deliberately simplified
mobile composition rather than a scaled-down desktop one.

**Motion.** Reuse `animate-fade-in` and `animate-modal-in`. Under
`prefers-reduced-motion`, previews skip to their final frame and hold.

## Gate and dismissal

**Soft gate.** The modal opens automatically when
`user_metadata.welcome_onboarded_at` is absent. Unlike the branding
wizard, which blocks Escape and outside clicks, this modal is
dismissible by Escape, by a close control and by the backdrop.

A hard gate was considered and rejected: these are paying users who
signed up on purpose and will mostly complete the flow anyway, but a
hard gate turns any single broken step into a support ticket that locks
someone out of a product they just paid for.

**Once only.** Any exit stamps `welcome_onboarded_at`, including a
dismissal at step 1. Exiting before step 3 saves the flag but no fields,
which is intended: they chose not to fill it in, and we do not ask
twice. All the fields remain available in Settings.

## Data flow

**Where the flag lives.** `user_metadata.welcome_onboarded_at`, an ISO
timestamp.

This is a deliberate exception to the general preference for
server-owned state. `user_metadata` is user-writable, so a determined
user could clear the flag and see the modal again, which is harmless
for "have you seen the welcome screen". In exchange there is no
migration and no query: the flag rides in the JWT and the gate reads it
off the user object already in context.

Note this is *not* an entitlement field. The `app_metadata` rule in
`.claude/docs/authentication.md` §7.4 governs trust-level fields
(`account_type`, `subscription_*`, `stripe_*`) and does not apply here.

**Where the profile fields go.** `user_metadata`, written with
`supabase.auth.updateUser({ data })`, the same call
`personal-info-section.tsx` already makes. One write path, no new shape.

**When writes happen.** Exactly twice:

1. Step 3's Next writes eight fields: `display_name` and
   `business_name` (editable prefills), plus phone, address (with
   `address_lat` / `address_lng`), signature name, website, Instagram
   and Facebook. Email is never written here.
2. Any exit stamps `welcome_onboarded_at`.

**Avoiding the flash.** A localStorage hint
(`zebri:welcome-onboarded`), written on completion and read
synchronously on mount, keeps the modal from appearing briefly on a slow
hydrate. This mirrors the branding page's approach at
`app/(dashboard)/branding/page.tsx:122`.

## Error handling

**Save failure must never trap the user.** Steps 2-3 collect optional
data. On a failed write: an inline message on the step, Next stays
enabled, and the user continues. Nothing is permanently lost, since every
field is editable in Settings.

**No `sendAlert()`.** A failed optional-profile write is not an
operational event worth a Slack ping.

**Five of eight steps have no network surface at all.** Steps 1, 4-7
and 8 are pure presentation, so there is no loading, empty or error
state to design across most of the flow.

## File structure

```
app/(dashboard)/onboarding/
  welcome-modal.tsx        modal shell, gate, dismissal
  welcome-wizard.tsx       step state machine, save on step 3
  wizard-chrome.tsx        footer nav + progress bar
  steps/
    step-welcome.tsx       1
    step-details.tsx       2
    step-links.tsx         3
    step-preview.tsx       4-7, one component, four scripts
    step-founder.tsx       8
  previews/
    preview-frame.tsx      shared mini-app chassis
    script-couple.tsx      4
    script-template.tsx    5
    script-send.tsx        6
    script-automation.tsx  7
```

Every file stays under the ~150 line rule. The wizard owns step state
and knows nothing about how any preview animates. Each script receives
`active` and `reducedMotion` and exposes nothing else, so a preview can
be rewritten without touching the wizard.

## Testing

**Unit** (`tests/unit/onboarding/`):

- Step navigation forward and back across all eight steps.
- Step 3's Next writes exactly the six expected fields.
- A failed save leaves Next enabled and surfaces an inline message.
- Every exit path (Finish, Escape, close control, backdrop) stamps
  `welcome_onboarded_at`.
- Under `prefers-reduced-motion`, previews render their final frame.

**E2E** (`tests/e2e/`), on desktop, Pixel 5 and iPhone 12:

- A fresh user walks all eight steps and lands on the dashboard.
- A user who dismisses at step 4 keeps the details they entered and does
  not see the modal again after reload.

**No integration tests.** Nothing here touches an owned table, so there
is no RLS surface and no row to tick in the `security.md` matrix.

**Security checklist** is thin by construction: no API route, no Zod
schema, no rate limit, no cron auth, no webhook, no service-role key.
The single write goes through `auth.updateUser`, which Supabase scopes
to the calling user.

## Docs to update in the same PR

- `page-specs.md`: the onboarding flow and its gate.
- `component-library.md`: the preview components and `PreviewFrame`.
- `testing.md`: new selectors.

## Build order

1. Modal shell, chrome, and the step state machine.
2. Steps 1, 2, 3 and 8, plus the save and the gate. These are
   straightforward and get the flow end-to-end early.
3. The four previews, in narrative order.

The previews are the bulk of the work and the part most likely to need
visual iteration in the running app rather than landing right the first
time.

## Known risks

**The flow has two halves with opposite failure modes.** Steps 2-3
collect data; steps 4-7 are a passive tour. A user who fills in their
details and then meets four screens of animation may well close at step
4, having already given us what we wanted. That outcome is acceptable,
and the save at step 3 is what makes it acceptable, but it means the
previews must carry their own weight rather than assume a captive
audience.

**Placeholder copy on step 8.** Tracked above; must not ship as-is.

**Preview drift.** Mocks resemble the real UI by hand, not by
construction. When a real screen changes materially, the matching
preview needs a look.
