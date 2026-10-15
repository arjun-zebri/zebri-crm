# Outreach: setup and how-to

This is the plain-English guide to **Outreach** (`/admin/outreach`).
It has its own **Outreach** link in the left sidebar, just above Admin.
Only admins can see it.
It covers what you need to set up and how to run your celebrant outreach
day to day. The engineering reference is `.claude/docs/outreach.md`.

---

## What it is, in one paragraph

You upload your list of celebrants. Zebri checks which ones are still
working: it looks at their website and, if needed, their Instagram.
Then it runs **sequences** of messages to the active ones. Emails go out
automatically from your Gmail, a few at a time. Instagram DMs are queued
for you to send by hand with one click. Replies, bookings, bounces and
opt-outs stop a person's sequence automatically. Every touch is logged,
so **Analytics** can tell you which message, channel or timing actually
books demos and paying users.

---

## Part 1: One-time setup (do this before anything sends)

### 1. Environment variables (Vercel and `.env.local`)

| Variable | What it's for | Where to get it |
|---|---|---|
| `OUTREACH_GOOGLE_CLIENT_ID` | Gmail connection | Google Cloud (see step 2) |
| `OUTREACH_GOOGLE_CLIENT_SECRET` | Gmail connection | Google Cloud (see step 2) |
| `APIFY_TOKEN` | Instagram profile lookups | apify.com → Settings → Integrations |
| `EMAIL_CRED_KEY` | Encrypts the stored Gmail token | Already used elsewhere. Make sure it's set in **prod** |
| `CRON_SECRET` | Lets the per-minute cron run outreach | Already used elsewhere. Make sure it's set in **prod** |
| `NEXT_PUBLIC_APP_URL` | Builds booking links and the OAuth redirect | Should already be set |

`EMAIL_CRED_KEY` and `CRON_SECRET` were missing in prod as of 2026-08-17.
Check them first: without `CRON_SECRET` nothing sends at all.

### 2. Google OAuth client (about 10 minutes)

1. Go to <https://console.cloud.google.com> and pick a project under your
   **zebri Google Workspace** organisation.
2. **APIs & Services → Library**, then enable **Gmail API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **Internal**.
   - Internal means Google skips its slow review for Gmail read access.
     It also means only Workspace accounts in your org can connect.
4. **APIs & Services → Credentials**:
   - Choose **Create credentials → OAuth client ID → Web application**.
   - Add this authorised redirect URI:
     `https://<your-app-domain>/api/admin/outreach/gmail/callback`
   - For local testing, also add
     `http://localhost:3000/api/admin/outreach/gmail/callback`.
5. Copy the client ID and secret into the two env vars above, then redeploy.

The app asks for two permissions: **send** (`gmail.send`) and **read**
(`gmail.readonly`). Read access is only used to spot replies and bounces.

### 3. Apify (Instagram checks)

1. Sign up at <https://apify.com> (the free plan is fine).
2. Copy your API token into `APIFY_TOKEN`.
3. The free plan's monthly credit (about US$5) covers about **2,000
   Instagram lookups**. Zebri never spends past the budget you set in
   Settings (default US$5/month).

### 4. Database

The tables come from `supabase/migrations/20261028000000_create_outreach.sql`.
They deploy the normal way, through the CI `supabase db push` on merge.
Never paste the migration into the Supabase SQL editor.

### 5. In the app: Outreach → Settings

Click **Outreach** in the sidebar. The page has one row of tabs: Today,
Prospects, Checks, Sequences, Campaigns, Pipeline, Analytics and
Settings. Once Gmail is connected, the header shows today's counts (for
example "Today: 2/5 emails · 4/20 DMs"). **Check replies now** appears
on Today.

The fastest way through setup is the **Get set up** guide on Today (see
Part 5). Settings has the same things as a checklist, if you want to
fix one item in place. Work down it:

1. **Connect Gmail.** Sign in with the Workspace inbox you want to send
   from. Use a real inbox you check, because replies land there.
   Disconnecting **pauses all sending**. Emails already scheduled stay
   queued. After you reconnect, click **Resume sending**: reconnecting
   alone doesn't resume.
2. **Sender name and signature.** Both are required before an email
   campaign can start. The signature goes under every email, and the law
   requires it: it identifies who you are.
3. **Booking page.** Pick the Zebri Scheduler meeting type for demos. Do
   this if any message uses `{{booking_link}}`. Each person gets their own
   tagged link, so a booking is credited to them.
4. **Caps and timing.** The defaults are sensible:
   - **Email warm-up:** 5 a day in week 1, then 10, 20 and 30. New
     senders who blast lots of email get flagged as spam, so the daily
     limit climbs slowly.
   - **Hard email cap:** 30 a day. **Instagram DM cap:** 20 a day.
   - **Send window:** 9am to 4pm on weekdays, in each celebrant's own
     state's timezone.
   - **Instagram budget:** US$5 a month.

---

## Part 2: Getting your list in and finding active celebrants

### Step 1: Import the sheet (Outreach → Checks → Import sheet)

1. In Google Sheets, choose **File → Download → Comma-separated values
   (.csv)**.
2. Click **Import sheet** and choose the file.
3. **Match columns.** Zebri guesses which column is which and shows a
   sample value for each, so you can correct any wrong guesses.
   - **Required:** a name, either one Full name column or First name +
     Last name.
   - **Optional:** registration number, state, suburb, postcode, email,
     phone, website, Instagram, Facebook, your notes, your status column.
4. **Preview** shows how many people are new, how many will merge into
   existing people, and how many will be skipped. Nothing saves until you
   click **Import**.

Re-importing is safe. People are matched on **registration number**, or
**name + suburb** if there's no registration number. A merge **only fills
in blanks** and never overwrites what's already there.

### Step 2: Run the activity check (Checks → Run activity check)

1. Choose which groups to check. "Unchecked" is the default, and each
   group shows how many people are in it.
2. Start it. **Keep the tab open** and it checks at full speed: about 10k
   websites take a few hours. If you close the tab, it keeps going slowly
   in the background.
3. What it does for each person:
   - **Website** (free): is it live, does it mention 2025 or 2026, does it
     show wedding content? It also picks up any email, Instagram or
     Facebook links it finds.
   - **Email** (free): is the address well-formed, does the domain accept
     mail, is it a throwaway address?
   - **Instagram** (paid, from your budget): only when the website didn't
     settle it. Checks when they last posted.
4. Each person gets:
   - a **verdict**: **Active**, **Inactive** or **Needs review**;
   - an **activity score** from 0 to 100, used to rank people and filter
     campaigns.

Active means they posted on Instagram in the last 180 days, **or** their
website is live and mentions 2025/2026 or shows wedding content.

### Step 3: Clear the Needs-review queue (bottom of Checks)

These are people the check couldn't decide on, for example because their
site was down. Each card links to their website and Instagram so you can
look yourself. Use the keyboard:

- `A`: Active
- `I`: Inactive
- `S`: skip for now

A decision you make by hand is never overwritten by a later check.

---

## Part 3: Writing your messages (Outreach → Sequences)

A **sequence** is a series of steps, for example:

| Step | Channel | When |
|---|---|---|
| 1 | Email | Day 0, the day they're enrolled |
| 2 | Instagram DM | 3 days after step 1 |
| 3 | Email follow-up | 4 days after step 2 |

- **"Start from a template"** gives you a ready-made 4-step sequence to
  edit.
- **Email steps** need a subject on the first email. Later emails reply
  in the same thread unless you tick "new thread".
- **Variants (A/B testing):** each step can have several versions (A, B,
  …). Each person gets one at random. **Weight** sets how often each
  version is picked: weights 1 and 1 give a 50/50 split, and 3 and 1 give
  75/25.
- **Merge fields** fill in each person's details. Use the **Insert field**
  menu, or type them:

  | Field | Becomes |
  |---|---|
  | `{{first_name}}` | Jane |
  | `{{last_name}}`, `{{full_name}}` | Smith, Jane Smith |
  | `{{suburb}}`, `{{state}}` | Bondi, NSW |
  | `{{website}}`, `{{instagram_handle}}` | their details |
  | `{{booking_link}}` | their personal demo booking link |
  | `{{sender_name}}` | your name from Settings |

  Add a fallback after a `|` for when a field is empty.
  `Hi {{first_name|there}}` becomes "Hi there" if there's no first name.
- **Preview** shows the message filled in for a made-up celebrant, Jane
  from Bondi, and warns you about anything that would come out blank.
- Every email gets your **signature** and the line *"Not for you? Just
  reply STOP and I won't email again."* added automatically. Don't add
  your own.
- **Rules:** emails are plain text, with no tracking pixels and at most
  one link (the booking link). This keeps you out of spam folders.

You can't archive or delete a sequence that a campaign is using. The
list shows how many campaigns use each one. **Delete** removes a
sequence for good, but only one nobody has been sent; once anyone has
been through it, archive it instead so its results stay in Analytics. You also can't remove a step or variant
that has already sent messages, because that would break its history in
Analytics. Removing anything else asks you to confirm first. Closing the
editor with unsaved changes asks before throwing them away. On a phone,
switch between **Steps** and **Preview** at the top.

---

## Part 4: Launching a campaign (Outreach → Campaigns)

A **campaign** decides **who** gets messaged and **with which
sequence(s)**.

1. **Audience:** choose states and a minimum activity score. A live
   count shows how many celebrants with an **Active** verdict match.
2. **Sequences:** tick one or more.
   - Each person is randomly assigned one of them. This is how you test,
     for example, "email first" against "Instagram first".
   - Weights work like variant weights.
   - A person only gets sequences where they can receive every channel.
     An email step needs an email that passed the check, and an
     Instagram step needs a handle.
3. **New people per day:** how many fresh people to start each day.
   Default 5. Follow-ups to people already enrolled are on top of this,
   always within your daily caps.
4. **Save** creates a **draft**. Nothing happens yet.
5. **Activate** asks you to confirm, showing how many people and how fast,
   then starts sending. If anything in the setup checklist is missing,
   it tells you what. Campaigns shows a one-line count of what's left,
   with a **Finish setup** link.

**Pause** stops new sends and keeps everyone's place, so you can resume
later. **Finish** ends the campaign for good. **Delete** (in the row's
menu, once it isn't active) removes a campaign that hasn't sent anything
yet. One that has sent can only be finished, so replies and STOP
requests to its emails are still caught.

To delete a prospect, open them and choose **Delete prospect** from the
menu. Their messages and history go with them. If they asked you to
stop, they stay blocked even if you add them again. To clear out a test
run, delete the test prospect first, then its campaign.

---

## Part 5: Your daily routine (Outreach → Today)

Open **Today** once a day. It refreshes every minute and only shows
what needs you.

- **Before setup is finished**, Today opens with **Get set up**: five
  numbered steps in the order to do them, with "N of 5 done" on the
  right. Only the next step has a button, so there is one thing to do
  at a time:
  1. **Connect Gmail.** Then add your sender name and signature.
  2. **Import your celebrant sheet.**
  3. **Run the activity check.**
  4. **Write your first sequence.**
  5. **Launch a campaign.** If a template uses `{{booking_link}}`, a
     warning under this step asks you to pick a booking page first.

  Instagram lookups sit below a line marked **Optional**. They don't
  count toward the five, and they need your developer to add the Apify
  key. The guide disappears once all five steps are done. Until then,
  Today shows only lists that have something in them, so an empty day
  doesn't look broken.
- **On a quiet day**, once setup is finished, there's nothing to do, so
  you'll see a single **All caught up**.
- **Otherwise** you'll only see the sections that have something in
  them:

1. **Sending paused** (only when it is): why it paused, with a
   **Resume sending** button.
2. **Instagram DMs** due today. For each person:
   1. Click **Copy & open**. The message is copied and their Instagram DM
      window opens.
   2. Paste it and send it from the Zebri Instagram account.
   3. Click **Sent**.
   - **Skip** asks for a reason, which is saved to their history.
   - **Can't DM** (for example, their DMs are closed) stops Instagram
     steps for that person. It asks you to confirm, because it can't be
     undone.
   - The queue remembers what you've already copied, even after a reload,
     so you won't DM someone twice.
3. **Needs attention:** replies, bounces, bookings and failures from the
   last few days. Opt-outs have an **Undo** in case the STOP detection got
   it wrong.
4. **Replied on Instagram?** Zebri can't read Instagram, so when someone
   replies there, click **Replied** next to their name and confirm. That
   stops their sequence.
5. **Failed emails:** click **Retry** once you've fixed the cause.
6. **Upcoming demos** and **Today's email queue**: what's booked and
   what's going out.

Today's email and DM counts against your daily caps are in the page
header, next to the title.

**Check replies now** (top right, on every tab) checks Gmail immediately. It normally checks every
5 minutes on its own.

**Answer replies in Gmail and Instagram as you normally would.** Zebri
doesn't have an inbox. It just notices replies and stops the sequence.

---

## Part 6: Tracking people

### Prospects

The full list of celebrants.

- **Filters:** verdict, stage, state, has email, has Instagram, and
  search. On a phone, tap **Filters**.
- **Bulk actions:** tick rows to set a verdict, re-check them, or mark
  them **Do not contact**. Bulk actions ask you to confirm first.
- **Prospect panel:** click a name to see everything about that person:
  - **Pipeline stage**, how positive the reply was, lost reason, notes,
    and Do not contact.
  - **Contacts:** edit their details.
  - **Activity:** what the check found.
  - **Sequence:** stop their sequence if needed.
  - **Messages** sent to them, and a full **timeline** of everything that
    happened.
  - **Log contact:** record a call or chat that happened outside Zebri.
  - **Link Zebri account:** link them if they signed up with a different
    email.

### Pipeline

A board with the stages **Contacted → Replied → Demo booked → Demo done
→ Signed up → Paying**, plus **Lost**.

- Most moves happen automatically:
  - a reply moves them to Replied;
  - a booking through their link moves them to Demo booked;
  - a signup with their email moves them to Signed up;
  - an active subscription moves them to Paying.
- To move someone by hand, drag a card by its handle or use its
  **Move to** menu.
- Moving someone to Lost asks why.

### Analytics

Answers "what's working?":

- the funnel from sent to replied to demo to paying;
- sends over the last 14 days;
- bounce and opt-out rates;
- comparisons by sequence, variant, step, send hour, weekday and segment.

Each rate has a **95% range**, meaning the true rate is very likely
inside it. If two options' ranges overlap a lot, you can't call a winner
yet. Rows with fewer than 30 sends are greyed out as too early to
compare.

---

## Part 7: Safety rails (automatic)

- **A reply, booking, opt-out or bounce** stops that person's sequence.
- **STOP replies** set **Do not contact** automatically. That blocks
  email and Instagram for good, unless you undo it by hand.
- **Too many bounces:** if more than 3% bounce over 14 days (with at
  least 20 sends), Zebri **pauses all sending** and alerts Slack. The
  same happens if Gmail refuses a send. To resume, fix the cause (often a
  bad batch of emails) and click **Resume sending** in Settings.
- **Spend cap:** Instagram lookups stop when the monthly budget is used
  up.
- **Legal (Spam Act):**
  - Every email identifies you (your signature), offers STOP, and has an
    unsubscribe header.
  - Celebrants' published business addresses count as inferred consent
    for a relevant business offer.
  - Keep messages relevant to their celebrant business.

---

## Quick checklist

- [ ] Env vars set in prod: `OUTREACH_GOOGLE_*`, `APIFY_TOKEN`,
      `EMAIL_CRED_KEY`, `CRON_SECRET`
- [ ] Google OAuth client (Internal) with the Gmail API enabled and the
      redirect URI added
- [ ] Today: **Get set up** shows 5 of 5 done (Gmail, sender name and
      signature, sheet, activity check, a sequence, a campaign)
- [ ] Checks: sheet imported, activity check run, Needs-review queue
      cleared
- [ ] Sequences: at least one written and previewed
- [ ] Campaigns: draft created, audience count looks right, activated
- [ ] Daily: open **Today**, clear the DM queue, mark Instagram replies
