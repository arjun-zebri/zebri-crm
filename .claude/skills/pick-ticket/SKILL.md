---
name: pick-ticket
description: Grab a ticket from the Zebri Tasks Tracker Notion queue, create a git worktree for it, and implement it. Invoke with /pick-ticket, optionally followed by a ticket ID (e.g. /pick-ticket ZEB-12).
argument-hint: "[ticket-id]"
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# Pick up a Zebri ticket and start work in a worktree

Ticket queue lives in Notion, "Tasks Tracker":

- Data source ID: `31bb6ea7-50d9-8082-893a-000b4ba24e31`
- URL: https://app.notion.com/p/31bb6ea750d980afac81f0b5e3b414e8

Requires the Notion MCP server to be connected (see the repo's setup notes). Ticket to work on, if the user gave one: **$ARGUMENTS**

## Step 1 — Choose a ticket

- If `$ARGUMENTS` names a ticket (e.g. `ZEB-12`), fetch that ticket from Notion directly and use it.
- Otherwise, query the Notion data source for tickets where:
  - **Status = "Ready for dev"**, and
  - **Repo is not empty**, and
  - **Sprint is not "Life"**

  sorted by **Priority** (High first).

  Those last two filters matter: Tasks Tracker also holds the user's personal to-dos. A task with no Repo, or one in the `Life` sprint, is not a dev ticket and must never be offered.

  Show the results as a short numbered list: `ZEB-id · Priority · Type · Title · Repo`. Then stop and let the user pick one. Do not start work until they choose.

## Step 2 — Read the ticket fully

Fetch the chosen ticket's page body. You need the **Summary**, **Steps to reproduce** (if a bug), **Acceptance criteria**, and **Notes for the implementer**. The acceptance criteria are your definition of done, treat them as the spec.

Note the ticket's **Slug**, **Ticket ID**, and **Repo**. Tickets in the `User submitted tickets` sprint came from the in-app Feedback pill, so their "Notes for the implementer" already carries the page, browser, viewport and build the report was filed from, and often a screenshot. Read it before you start guessing.

If the ticket has no **Slug** (reports filed from the app leave it blank for triage), pick a sensible kebab-case one and set it on the ticket before creating the branch.

## Step 3 — Create the worktree

Branch name: `ticket/ZEB-<id>-<slug>` (e.g. `ticket/ZEB-12-settings-autosave`).

From the repo root, create an isolated worktree so this ticket doesn't collide with anything else in progress:

```bash
git worktree add .claude/worktrees/<slug> -b ticket/ZEB-<id>-<slug>
```

Then do all work for this ticket inside `.claude/worktrees/<slug>`. If a `.worktreeinclude` file exists it will carry over env files automatically; if the worktree needs dependencies installed, install them there before building.

(If you're in the Claude Code desktop app, a session worktree may already exist. In that case just create/checkout the `ticket/ZEB-<id>-<slug>` branch rather than nesting another worktree.)

## Step 4 — Mark it in progress

Update the Notion ticket:

- **Status** -> `In progress`
- **Branch** -> `ticket/ZEB-<id>-<slug>`

`Status` is a Notion **status** property, not a select.

## Step 5 — Implement

Work through the acceptance criteria. Explore the codebase first, make the change, keep it tight and scoped to this one ticket. Run the project's tests and build/lint before you consider it done. Tick off each acceptance criterion as you satisfy it.

## Step 6 — Wrap up (stop and confirm before anything irreversible)

When the acceptance criteria are met and tests pass:

1. Commit on the ticket branch with a message like `ZEB-<id>: <title>`.
2. **Stop here and ask the user** before pushing the branch or opening a PR. Pushing is their call, not yours.
3. Once they confirm and you have a PR or commit URL, update the Notion ticket: **Status** -> `In review`, and set **Link** to the PR/commit URL.

## Guardrails

- One ticket per worktree. Don't pull extra scope in, even if you spot other issues. File those as new tickets instead (see the file-concern skill) and keep going on this one.
- Don't merge, force-push, or delete branches/worktrees unless asked.
- Never touch a task with no Repo set. That is somebody's personal to-do list.
- If the acceptance criteria are ambiguous or you hit a blocker, stop and ask rather than guessing.
