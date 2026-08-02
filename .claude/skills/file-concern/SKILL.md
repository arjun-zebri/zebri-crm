---
name: file-concern
description: Turn a raw concern, bug report, or feature idea into a structured ticket in the Zebri Dev Tickets Notion database. Trigger whenever the user describes something wrong with Zebri, a request from a user, or an idea they want built, or when they type /file-concern.
---

# File a Zebri concern as a ticket

Your job is to take a messy, human concern and turn it into one clean, well-scoped ticket in Notion, ready for a Claude Code worktree to pick up later.

## Where it goes
- Database: **Zebri Dev Tickets**
- URL: https://app.notion.com/p/79296fc8e16f4ef1925d516660955aa7
- Data source ID: `f47d84ef-d04f-4088-b471-88de96f2e531`

Create the page under that data source using the Notion connector.

## Steps

1. **Read the concern.** The user will describe a problem, a request, or an idea, often informally (e.g. "Marianna says settings don't save", "we should let couples pick a timezone", "the invoice PDF looks broken on mobile").

2. **Ask at most one clarifying question, and only if you genuinely can't scope it.** Don't interrogate. If the concern is clear enough to write a ticket, just write it. Good defaults beat a wall of questions.

3. **Structure it** into these fields:
   - **Ticket** (title): a short imperative summary, e.g. "Settings page doesn't autosave changes". No ticket number, Notion adds that.
   - **Type**: Bug, Feature, Improvement, or Chore.
   - **Priority**: High, Medium, or Low. Infer from impact. A paying user blocked = High. A nice-to-have = Low. If unsure, Medium.
   - **Status**: set to `Ready for dev` if it's clear enough to build, or `Triage` if it still needs a decision from the user.
   - **Area**: one or more of Frontend, Backend, Automations, Integrations, Onboarding, Billing, Design, Other.
   - **Repo**: `zebri-app` (the product) or `zebri-web` (marketing site), or `other`. Default `zebri-app` unless it's clearly the website.
   - **Reporter**: who raised it (e.g. Marianna, TJ, Sarah, or "internal" if it's the user's own idea).
   - **Slug**: a short kebab-case slug for the git branch, e.g. `settings-autosave`. Keep it under ~4 words, lowercase, hyphenated.

4. **Write the page body** using exactly this template:

```
## Concern (as raised)
[the original concern in the user's own words, lightly tidied]

## Summary
[1 to 3 sentences describing the problem or request clearly]

## Steps to reproduce   <- Bugs only, delete this section for features
1. ...
2. ...
3. ...

## Acceptance criteria
- [ ] [what "done" looks like, as testable checkboxes]
- [ ] ...

## Notes for the implementer
- [any hints, suspected cause, files to look at, or open questions]
```

For a Feature or Improvement, drop "Steps to reproduce" and make the acceptance criteria describe the desired behaviour.

5. **Create the page** in the Zebri Dev Tickets data source with those properties and body.

6. **Confirm back** in one line with the ticket title, its type/priority, and the Notion link. Don't narrate the whole ticket back, they can click through.

## Style
- Keep acceptance criteria concrete and testable. "Settings persist on reload" beats "fix settings".
- Don't invent scope the user didn't ask for. One concern, one ticket.
- If the user dumps several unrelated concerns at once, create one ticket per concern.
- Plain, direct English. No fluff.