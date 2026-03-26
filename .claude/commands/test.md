# /test — Run Playwright Tests and Improve

Load @.claude/docs/testing.md before starting.

## What this command does

Run Playwright tests across desktop and mobile viewports. For every failure or visual issue discovered, fix the underlying app code — do not just patch the test.

## Steps

1. **Run the tests**
   - Default: run all projects (desktop + mobile)
   - If the user specifies a scope (e.g. "couples", "mobile"), run that subset
   - Command: `npx playwright test [file] [--project=...]`

2. **Triage each failure**
   For each failing test, determine:
   - Is it a selector issue (UI changed but test wasn't updated)?
   - Is it a real bug (feature is broken)?
   - Is it a mobile layout issue (overflow, hidden element, wrong size)?

3. **Fix app code**
   - Fix the component or page causing the failure
   - Add `data-testid` attributes only if no semantic selector works
   - For mobile issues, use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
   - Never use raw CSS media queries — always use Tailwind classes

4. **Update the test (only if UI legitimately changed)**
   - Do not weaken assertions (e.g., don't remove `toBeVisible()` checks)
   - If selectors need updating, prefer `getByRole` > `getByLabel` > `getByText` > `data-testid`

5. **Re-run to confirm**
   - Run the fixed test(s) again to verify they pass
   - If mobile-specific, also verify on both `Pixel 5` and `iPhone 12` projects

6. **Report**
   - List what failed, root cause, and what was fixed
   - Note any new `data-testid` attributes added
   - Flag anything that was skipped or left for follow-up

## Scope examples

```bash
# All tests
npx playwright test

# One feature
npx playwright test tests/e2e/couples.spec.ts

# Mobile only
npx playwright test --project="Mobile Chrome" --project="Mobile Safari"

# Desktop only
npx playwright test --project=chromium --project=webkit

# One test by name
npx playwright test -g "should create a couple"
```

## Rules

- Always fix root causes, not symptoms
- Never disable or skip a test without a comment explaining why
- Never use `page.waitForTimeout()` as a fix — find the correct wait condition
- Always check mobile AND desktop when fixing layout issues
- After fixing, run `/ship-check` if the change touches a user-facing feature
