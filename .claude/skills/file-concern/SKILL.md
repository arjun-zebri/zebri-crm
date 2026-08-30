---
name: file-concern
description: Turn a raw concern, bug report, or feature idea into a structured ticket in the Zebri Tasks Tracker Notion database. Trigger whenever the user describes something wrong with Zebri, a request from a user, or an idea they want built, or when they type /file-concern.
---

# File a Zebri concern as a ticket

Your job is to take a messy, human concern and turn it into one clean, well-scoped ticket in Notion, ready for a Claude Code worktree to pick up later.

## Where it goes

- Database: **Tasks Tracker**
- URL: https://app.notion.com/p/31bb6ea750d980afac81f0b5e3b414e8
- Data source ID: `31bb6ea7-50d9-8082-893a-000b4ba24e31`

Create the page under that data source using the Notion connector.

Tasks Tracker is the single queue. It also holds the user's own non-dev tasks, so **every dev ticket must have `Repo` set** — that is what separates a ticket from a personal to-do, and it is what `/pick-ticket` filters on.

The in-app Feedback pill writes to this same database. Anything it files lands in the `User submitted tickets` sprint at status `Triage`.

## Steps

1. **Read the concern.** The user will describe a problem, a request, or an idea, often informally (e.g. "Marianna says settings don't save", "we should let couples pick a timezone", "the invoice PDF looks broken on mobile").

2. **Ask at most one clarifying question, and only if you genuinely can't scope it.** Don't interrogate. If the concern is clear enough to write a ticket, just write it. Good defaults beat a wall of questions.

3. **Structure it** into these fields:
   - **Task name** (title): a short imperative summary, e.g. "Settings page doesn't autosave changes". No ticket number, Notion adds that.
   - **Description**: a one-line preview of the concern, so the board is scannable. The full detail goes in the page body.
   - **Type**: Bug, Feature, Improvement, or Chore.
   - **Priority**: High, Medium, or Low. Infer from impact. A paying user blocked = High. A nice-to-have = Low. If unsure, Medium.
   - **Status**: set to `Ready for dev` if it's clear enough to build, or `Triage` if it still needs a decision from the user.
   - **Sprint**: `Backlog` for anything you file here. Leave `User submitted tickets` alone — that sprint means the report came through the in-app Feedback pill, and putting an internally-raised ticket there misrepresents where it came from. Never use `Life`, which is the user's personal tasks.
   - **Area**: one or more of Frontend, Backend, Automations, Integrations, Onboarding, Billing, Design, Other.
   - **Repo**: `zebri-app` (the product) or `zebri-web` (marketing site), or `other`. Default `zebri-app` unless it's clearly the website. **Always set this.**
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

5. **Create the page** in the Tasks Tracker data source with those properties and body.

6. **Confirm back** in one line with the ticket title, its type/priority, and the Notion link. Don't narrate the whole ticket back, they can click through.

## Notes on the schema

`Status` is a Notion **status** property, not a select. `Priority`, `Sprint`, `Type` and `Repo` are selects, `Area` is a multi-select, and `Ticket ID` is a read-only auto-incrementing ID with the `ZEB` prefix, so never try to set it.

## Style

- Keep acceptance criteria concrete and testable. "Settings persist on reload" beats "fix settings".
- Don't invent scope the user didn't ask for. One concern, one ticket.
- If the user dumps several unrelated concerns at once, create one ticket per concern.
- Plain, direct English. No fluff.
