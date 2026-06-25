# Zebri — QA Test Checklist (Release: 22 June 2026)

This is a hands-on testing guide for everything that shipped in the latest
release. It is written for a non-technical tester. You do **not** need to read
any code. Just follow the steps, click what it says to click, and check that
what you see matches the **"Should see"** note.

## How to use this document

1. Work through it top to bottom. Each section is one feature.
2. Tick the box `[ ]` → `[x]` once a step passes.
3. If something does **not** match the "Should see" note, that is a **bug**.
   Write it down using the bug report format below. Do not skip it.
4. Test on **two screens** where you can: a normal computer browser **and** a
   phone (or your browser's phone/mobile view). Zebri must work on both.

## How to report a bug

For every problem, capture:

- **Where:** the page/feature and the step number (e.g. "Automations → C2, step 4").
- **What I did:** the exact clicks/typing.
- **What I expected:** copy the "Should see" line.
- **What actually happened:** describe it, and take a **screenshot or screen recording**.
- **Device:** computer or phone, and which browser (Chrome, Safari, etc.).

## Before you start (setup)

- [ ] Log in with the test account you were given.
- [ ] Make sure there are at least **2 test couples** in the system (create them
      under **Couples → New couple** if needed). Give one couple a full email
      address and the other **no email** — we need both to test error handling.
- [ ] Have access to the test account's **own email inbox** — several tests send
      a "test" email there.

---

# 1. Navigation & sidebar

The left sidebar changed. Test it first because you'll use it everywhere.

- [ ] **1.1** Look at the left sidebar. **Should see** these items: Dashboard,
      Couples, Calendar, Tasks, Contacts, Payments, **Automations** (new),
      **Templates** (new), Branding, **Docs** (new), Settings. Admin only shows
      for admin accounts.
- [ ] **1.2** Click **Automations**. **Should see** the Automations page open.
- [ ] **1.3** Click **Templates**. **Should see** the Templates page open.
- [ ] **1.4** Click **Docs**. **Should see** it open the Zebri docs website in a
      **new browser tab** (it leaves the app). The Docs item should **not** look
      "selected/active" like the in-app pages do.
- [ ] **1.5** Collapse / expand the sidebar (look for the collapse toggle).
      **Should see** the sidebar narrow to icons only and expand back. The labels
      should not overflow or look broken while it animates.
- [ ] **1.6 (Phone)** On a phone width, open and close the sidebar menu.
      **Should see** it slide in over the page and close cleanly.

---

# 2. Automations (the big one)

Automations let an MC set up workflows that run on their own, e.g. "when a quote
is sent, wait 2 days, then email the couple a reminder."

## 2A. The Automations list page

- [ ] **2A.1** Go to **Automations**. **Should see** a page title, a **New
      automation** button, four summary cards across the top (Total, Active,
      Couples in flow, Paused), tabs (**All / Active / Paused / Draft**), a
      search box, and a table of automations.
- [ ] **2A.2** Click each tab. **Should see** the list filter to only those
      automations (e.g. "Active" shows only switched-on ones).
- [ ] **2A.3** Type a word into the search box that matches an automation name.
      **Should see** the list narrow to matching automations. Clear it → full
      list returns.
- [ ] **2A.4** In a table row, flip the **On/Off** toggle. **Should see** the
      automation switch between Active and Paused. Refresh the page → the new
      state sticks.
- [ ] **2A.5** Open a row's **"…" (more) menu** and choose **Delete**.
      **Should see** a confirmation first, then the automation disappears.
- [ ] **2A.6** If any automation has recently failed, a **health banner** shows
      at the top ("X automation(s) have errored in the last 7 days"). Click it.
      **Should see** it open the failing automation. (Skip if no failures exist.)
- [ ] **2A.7 (Phone)** Open this page on a phone. **Should see** the cards stack,
      and the table become easy-to-read stacked cards. Everything stays tappable.

## 2B. Building an automation (the canvas)

- [ ] **2B.1** Click **New automation**. **Should see** a blank builder open. The
      top card says something like **"Click to choose a trigger"**, and there is
      **no** "Add action" button yet. Status is **Draft** (toggle off).
- [ ] **2B.2** Click the automation **name** in the header and type a new name.
      **Should see** the name update and a **"Saved"** indicator appear. Refresh →
      the name sticks.
- [ ] **2B.3** Click the **trigger card**. **Should see** a searchable list of
      triggers grouped by category (Enquiries, Quotes, Invoices, Contracts,
      Calendar, Portal, Tasks, Contacts, etc.).
- [ ] **2B.4** Search "quote" → **Should see** only quote-related triggers. Pick
      **Quote due**. **Should see** the card update to "Quote due", a config panel
      open on the right (e.g. "Days until due"), and an **Add action** option now
      appears.
- [ ] **2B.5** Set the trigger's number field (e.g. "7" days). **Should see** the
      "Saved" indicator update.
- [ ] **2B.6** Click **Add action**. **Should see** a picker listing actions
      grouped by category, with **Flow control** (Wait, Branch, Stop) near the top.
- [ ] **2B.7** Add a **Send email** action. **Should see** it appear under the
      trigger and a config panel with: Subject, Body (rich text), Recipients
      (Primary / Spouse / Family / Vendor / Myself), and options like "branded
      shell", reply-to, CC, BCC.
- [ ] **2B.8** In the Body, use the **Insert variable** helper. **Should see** a
      list of merge fields (couple name, event date, business name, etc.). Insert
      one. **Should see** a live preview where the variable is filled with sample
      data.
- [ ] **2B.9** Add a **Wait** action (e.g. "Wait 2 days", "respect quiet hours"
      ticked). **Should see** it added with a clock-style icon.
- [ ] **2B.10** Add a second **Send email** after the wait. **Should see** the
      flow read: Trigger → Email → Wait → Email.
- [ ] **2B.11** Add a **Branch** (if/else), e.g. "if amount is over $5000".
      **Should see** the diagram split into a **Yes** path and a **No** path. Add
      a different action to each path.
- [ ] **2B.12** Add a **Stop** action. **Should see** it end that path (nothing
      can come after it).
- [ ] **2B.13** Click any action, then click **Delete** in its panel.
      **Should see** a confirmation, then the action is removed.
- [ ] **2B.14** Drag an action to a new position. **Should see** the order change.
      Refresh → the new order sticks.
- [ ] **2B.15 Validation:** On a Send email action, clear the Subject and try to
      save. **Should see** a clear error ("Subject is required") rather than a
      silent failure. Same for an empty Body.

## 2C. Turning on, testing, and running

- [ ] **2C.1** With a finished automation (trigger + at least one action), flip
      the **Activate** toggle on. **Should see** status change to **Active**, and
      on the list page it now shows under the Active tab.
- [ ] **2C.2** Click **Test** in the builder header. **Should see** a prompt to
      pick a couple. Pick one and run. **Should see** a preview of what would
      happen (emails rendered with that couple's real details). Any test email
      lands in **your own inbox** with **[Test]** in the subject — **not** in the
      couple's inbox.
- [ ] **2C.3** Go to a couple → **Automations** tab → **Run manually**. Pick an
      automation. **Should see** it run for real now: the email actually goes to
      the couple, tasks get created, and a new run appears in the activity feed.
- [ ] **2C.4 (Quiet hours)** With a "Wait" action set to respect quiet hours,
      a follow-up that would land during the MC's quiet hours (e.g. overnight)
      should be held until the next allowed time (e.g. 8am), **not** sent in the
      middle of the night.

## 2D. Run history & errors

- [ ] **2D.1** In the builder, click **Runs**. **Should see** a panel listing
      recent runs, each with a status (Completed / Waiting / Errored / Running /
      Cancelled) and a friendly time ("3 days ago").
- [ ] **2D.2** Find or create a failure: run an email automation against the
      couple that has **no email**. **Should see** the run marked **Errored** with
      a plain-English reason like **"Couple has no email address"** (not a scary
      technical error).

## 2E. The couple's Automations tab

- [ ] **2E.1** Open a couple → **Automations** tab. **Should see** a summary
      strip ("3 active · 1 waiting · 1 failed"), buttons **Test**, **Run
      manually**, **Pause all**, and an activity feed.
- [ ] **2E.2** A couple with nothing run yet **Should see** a friendly empty
      state, not a blank screen.
- [ ] **2E.3** Expand an automation row. **Should see** each step it ran, e.g.
      "✓ Sent reminder email", "⏳ Waiting — will send on 22 Jun",
      "✗ Failed — couple has no email [Retry]".
- [ ] **2E.4** On a **failed** run, click **Retry**. **Should see** it run again
      and the feed update.
- [ ] **2E.5** On a **waiting** run, click **Cancel**. **Should see** it change to
      Cancelled and stop.
- [ ] **2E.6** Click **Pause all**, confirm. **Should see** all live runs pause
      and the "Pause all" button go away. Resume one → the button comes back.
- [ ] **2E.7 (SMS note)** If you see a **Send SMS** action anywhere, it is marked
      **"coming soon"** and should be greyed out / not usable. That is expected,
      not a bug.

---

# 3. Templates page

Go to **Templates** in the sidebar. It has tabs across the top: **Emails,
Packages, Quotes, Invoices, Timelines, Contracts**. Click each tab and confirm
it loads.

## 3A. Email templates

- [ ] **3A.1** On the **Emails** tab, click **New template**. Enter a name, pick a
      stage (Enquiry / Pre-event / Post-event / Nurture / Transactional), a
      subject, and a body. **Should see** a live **preview** on the side showing
      the finished email with sample data.
- [ ] **3A.2** Use **Insert variable** in both the subject and the body.
      **Should see** a list of merge fields; inserting one shows it filled in the
      preview (e.g. couple name → "Sam"). Missing data shows **highlighted in
      amber** in the preview.
- [ ] **3A.3** Save. **Should see** a success message and the template in the list
      with its stage badge.
- [ ] **3A.4** Click the template to **edit** it, change something, save.
      **Should see** the change persist.
- [ ] **3A.5** **Delete** a template (row "…" menu). **Should see** a confirm,
      then it's gone.
- [ ] **3A.6 Validation:** Try to save a template with a blank name.
      **Should see** an error, not a silent save.

## 3B. Starter template library

- [ ] **3B.1** Click **Browse starter templates**. **Should see** a library of
      ready-made templates grouped by stage (enquiry replies, booking
      confirmations, payment reminders, follow-ups, etc.).
- [ ] **3B.2** Click **Add** on one. **Should see** a confirmation and it appears
      in your Emails list, fully editable.
- [ ] **3B.3** Use **Add all**. **Should see** the count add correctly (e.g.
      "Added 5 templates").
- [ ] **3B.4** Once everything is added, reopen the library. **Should see** a
      message that there's nothing left to add (and that deleted ones can be
      re-added here).

## 3C. Packages

- [ ] **3C.1** On the **Packages** tab, click **New Package**. Add a name, an
      optional subtitle, and a couple of priced line items. **Should see** a
      preview card with the items and a running **total**.
- [ ] **3C.2** Save → **Should see** the package in the list with its item count
      and total.
- [ ] **3C.3** Edit a package, delete a line item → **Should see** the total
      update. Save and reopen → changes stuck.
- [ ] **3C.4** Drag packages to reorder → **Should see** the order persist after
      refresh.
- [ ] **3C.5** **Browse starter packages** (e.g. Ceremony MC, Reception MC, Full
      Day MC). Add one → **Should see** it appear with its line items pre-filled
      and editable (so the MC can change the prices to their own rates).
- [ ] **3C.6 Validation:** Save a package with no name → **Should see** an error.

## 3D. Invoice templates

- [ ] **3D.1** On the **Invoices** tab, click **New Invoice Template**. Add a name.
- [ ] **3D.2** Use **Add from package or quote** and pick a package.
      **Should see** that package's line items copied in. Editing them here must
      **not** change the original package (it's a copy/snapshot).
- [ ] **3D.3** Save → **Should see** it in the list with its total.

---

# 4. Email signatures

Go to **Settings → Signature**.

- [ ] **4.1** **Should see** an editor with a formatting toolbar, and a note that
      the signature gets inserted into emails.
- [ ] **4.2** Type a few lines (e.g. "Warm regards," / your name / business name).
      Make one line **bold** and give another a **color** using the toolbar.
      **Should see** the formatting apply.
- [ ] **4.3** Add a **link** (select text → link button → enter a URL).
      **Should see** it become an underlined link.
- [ ] **4.4** Add an **image** (image button → choose a file). **Should see** it
      upload and appear. Try resizing and deleting it.
- [ ] **4.5 Auto-save:** Make a change and pause. **Should see** a "Saving…" then
      "Saved" indicator (there is **no Save button**). Refresh → the signature is
      still there.
- [ ] **4.6** In an email template, insert the **signature** variable. **Should
      see** your signature (with bold/color/image) appear in the preview.

---

# 5. Sending emails to a couple

Open a couple's profile and find the **Emails** tab.

- [ ] **5.1** Click **Send email**. **Should see** a way to pick a template, then
      a compose view with subject and body **pre-filled and personalised** to this
      couple, plus a live preview of what they'll receive.
- [ ] **5.2** Edit the subject/body slightly → **Should see** the preview update.
- [ ] **5.3** Send → **Should see** a success message, the window close, and the
      email appear in the couple's **email history** below (subject, status,
      time).
- [ ] **5.4 Missing info:** If the template uses a field the couple doesn't have
      (shown in **amber**), **Should see** a warning and a **"Send anyway"** option
      before it lets you send.
- [ ] **5.5 No email on file:** Try to send to the couple with **no email
      address**. **Should see** a clear error telling you to add an email first.
      Nothing should be sent.
- [ ] **5.6 Test send:** Click **Test**, pick a template, send. **Should see** the
      email arrive in **your own inbox** with **[Test]** in the subject, and it
      should **not** appear in the couple's email history.
- [ ] **5.7 Email history:** **Should see** sent emails listed newest first with a
      status (Sent / Pending / Failed) and time. A couple with no emails shows a
      friendly empty state.

---

# 6. Connect your own email (Gmail / Outlook)

Go to **Settings → Public Page → Email** section.

- [ ] **6.1** **Should see** two choices: **Send from Zebri** (default, "works
      instantly") and **Connect your own email** (Gmail/Outlook so replies come to
      you).
- [ ] **6.2** Choose **Connect your own email** → **Should see** Connect Gmail /
      Connect Outlook buttons.
- [ ] **6.3** Click **Connect Gmail** → **Should see** Google's sign-in/permission
      screen. Approve → you return to settings, see **"Mailbox connected"**, your
      address shown, and a **Disconnect** button.
- [ ] **6.4** Send an email to a couple (Section 5) while connected → **Should
      see** it come **from your address**, and a copy land in your Gmail **Sent**
      folder. A reply from the couple should come to **you**, not Zebri.
- [ ] **6.5** Click **Disconnect** → **Should see** it revert to "Send from
      Zebri".
- [ ] **6.6** Switch back to **Send from Zebri** → **Should see** it save right
      away with no extra setup.

---

# 7. Settings modal & auto-save

Settings now open as a pop-over panel on top of whatever page you're on.

- [ ] **7.1** Click **Settings** in the sidebar from any page. **Should see** a
      centered panel open **over** the current page (the page is still visible
      behind it). The web address shows `/settings`.
- [ ] **7.2** Close it three ways and confirm each works: the **X** button,
      pressing **Esc**, and **clicking the dark area outside** the panel.
- [ ] **7.3** **Should see** the settings tabs down the left (desktop): Personal
      Info, Account, Plans & Billing, Receive Payments, Public Page, Signature,
      Privacy, Terms. On a phone they appear as pills across the top.
- [ ] **7.4** Click between tabs → **Should see** content switch instantly (no
      full page reload).
- [ ] **7.5 Auto-save:** In **Personal Info**, change a field and click away.
      **Should see** a brief "Saving…" then a **"Saved"** check. There is **no
      Save button**. Refresh → the change persisted.
- [ ] **7.6 Privacy / Terms:** Open the **Privacy** and **Terms** tabs.
      **Should see** the full policy text, a "last updated" date, and a link to
      view the latest on the Zebri website (opens a new tab).

## 7A. Public page address

- [ ] **7A.1** Open **Public Page**. **Should see** a field for your Zebri address
      ending in `.zebri.com.au`, and a preview of where it's used (portal,
      invoices, quotes, contracts) that **updates as you type**.
- [ ] **7A.2** Type a normal name (capitals/spaces) → **Should see** it tidy up to
      lowercase-with-hyphens.
- [ ] **7A.3** Try a reserved/taken word (e.g. "www", "admin") → **Should see** a
      "that address is taken" style error.

---

# 8. Couple pipeline statuses

You can now customise the columns/statuses on the Couples board.

- [ ] **8.1** Go to **Couples**. Find the small **gear icon** in the toolbar
      (near "New couple") and click it. **Should see** a **Manage statuses**
      window listing your current statuses.
- [ ] **8.2** Each status row **Should see**: a drag handle, the name, a colour
      picker, and a delete (trash) button.
- [ ] **8.3 Rename:** Change a status name. **Should see** a **Save changes**
      button appear. Save → window closes.
- [ ] **8.4 Colour:** Open the colour picker and pick a new colour. **Should see**
      the dot change.
- [ ] **8.5 Reorder:** Drag a status up or down. **Should see** it move.
- [ ] **8.6 Add:** Click **Add status**, enter a name and colour, **Create**.
      **Should see** it appear in the list.
- [ ] **8.7 Delete:** Delete a status that is **not** in use → **Should see** it
      vanish. Delete one that couples are **currently using** → **Should see** a
      blocked/error message (you can't delete an in-use status).
- [ ] **8.8 Verify on the board:** Save your changes and look at the Couples
      **board** view. **Should see** the columns match your statuses (names +
      colours). The status **filter** dropdown should also list them. Drag a
      couple between columns → its status updates.
- [ ] **8.9 Discard:** Rename a status, then close with the **X** (don't save).
      Reopen → **Should see** the old name (unsaved changes were discarded).

---

# 9. Vows

## 9A. MC side (couple profile)

- [ ] **9A.1** Open a couple → **Vows** tab. **Should see** an editor for each
      partner's vows side by side (stacked on phone). No vows yet shows a friendly
      empty message.
- [ ] **9A.2** Type some vows and click away. **Should see** a brief "Saving…"
      then "Saved". Refresh → the text is still there.
- [ ] **9A.3** Click the **History** button on a vow. **Should see** a list of past
      versions, newest first, each with who wrote it ("Couple's version" /
      "Your edit") and when.
- [ ] **9A.4 Restore:** Click an older version. **Should see** the editor switch to
      that version's text, and a new history entry get added (nothing is lost).
- [ ] **9A.5 PDF:** In the couple header, open the **file/download** menu and pick
      **Download vow for [partner]**. **Should see** a clean, printable vows
      document open (ready to save as PDF). A partner with no vows shows
      "(No vows written.)".

## 9B. Couple's portal side

- [ ] **9B.1** Open the couple's **portal link** (from the couple header **Link**
      menu) and go to the **Vows** section (if enabled). **Should see** a single
      vows box for that partner with autosave.
- [ ] **9B.2 Privacy:** Each partner only sees **their own** vows, never their
      partner's. Open the **secondary partner's** link → **Should see** the other
      vow, not the first partner's.

---

# 10. Client portal (couple-facing)

Open a couple's portal link in a private/incognito window to view it as the
couple would.

- [ ] **10.1 Overview:** **Should see** a redesigned overview with a **"Your
      details"** area (two contact cards: Primary and Secondary) and an
      **Events** area.
- [ ] **10.2 Edit details:** Hover/click a field (name, email, phone) and change
      it, then click away. **Should see** a "Saving…/Saved" indicator and the
      change persist on refresh.
- [ ] **10.3 No wasted saves:** Click into a field, change nothing, click away →
      **Should see** no "Saving…" appear.
- [ ] **10.4 Add event:** Click the **+** in Events, enter a date and venue, save.
      **Should see** it appear in the timeline with a countdown ("3 days out",
      "Today", or "Past").
- [ ] **10.5 Edit event:** Click an existing event, change the venue/date, save.
      **Should see** the timeline update and re-sort if the date changed.
- [ ] **10.6** The couple should be able to edit the **date and venue** only —
      there should be **no delete** button and no way to change event status (those
      stay with the MC).
- [ ] **10.7 Per-partner links:** From the couple header **Link** menu, copy both
      the **primary** and **secondary** partner links (they're different). Each
      opens the portal for that partner. Try **Rotate links** → **Should see** new
      links, and the old ones stop working.
- [ ] **10.8 (Phone)** View the portal on a phone. **Should see** cards stack into
      one column and everything stays readable and tappable.

---

# 11. Payments fixes (regression checks)

These were broken before and are now fixed — please confirm.

- [ ] **11.1 Quote status:** Create a new quote and **send** it to a couple.
      **Should see** its status flip to **Sent** (previously it could wrongly stay
      "Draft"). The send-time/date should be recorded.
- [ ] **11.2 Invoice status & mark-as-sent:** Send an invoice → **Should see** it
      move to **Sent**. There should also be a **Mark as sent** option for
      invoices you sent outside Zebri.
- [ ] **11.3 Due-today:** An invoice due **today** should **not** be wrongly
      labelled **Overdue**.
- [ ] **11.4 Send preview:** When sending a quote or invoice email, **Should see**
      a **preview** of the email before it goes out.

---

# 12. General quality pass (do for every page you touch)

- [ ] **12.1 No broken states:** No blank white screens, no "undefined", no raw
      error codes shown to the user. Loading shows a spinner/skeleton; empty lists
      show a friendly message; failures show a readable message with a way to
      retry.
- [ ] **12.2 Phone view:** Re-check the main new pages (Automations, Templates,
      couple Emails/Vows/Automations tabs, Settings, Portal) on a phone width.
      Nothing should overflow, overlap, or be too small to tap.
- [ ] **12.3 Buttons do something:** Every button you press gives feedback
      (a result, a message, or a loading state). Nothing should look clickable but
      do nothing.
- [ ] **12.4 Refresh test:** After saving anything, refresh the page and confirm
      it really saved.

---

## Priority order (if you're short on time)

1. **Sending emails to couples** (Section 5) — real money/communication.
2. **Automations: test, run, errors** (2C, 2D, 2E).
3. **Connect your own email** (Section 6).
4. **Payments fixes** (Section 11).
5. **Templates + signatures** (Sections 3, 4).
6. **Portal + vows** (Sections 9, 10).
7. **Settings + statuses** (Sections 7, 8).
8. **Navigation + general pass** (Sections 1, 12).
