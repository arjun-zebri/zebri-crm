---
description: Pre-ship checklist for Zebri features
---

@.claude/docs/frontend-design.md
@.claude/docs/component-library.md
@.claude/docs/database-schema.md

Run a full pre-ship review on the current changes. Work through each section:

## UI Checklist
- [ ] All text uses `text-sm` unless it's a heading
- [ ] No `rounded-full` on buttons (use `rounded-xl`)
- [ ] All icons have `strokeWidth={1.5}`
- [ ] No native `<select>` or raw `<button>` elements
- [ ] No inline styles
- [ ] Interactive elements have `cursor-pointer`
- [ ] Empty states exist for all lists/tables

## Architecture Checklist
- [ ] Page files are orchestrators only (no form logic, no mutations)
- [ ] Section components are co-located with their page
- [ ] No component exceeds ~150 lines
- [ ] Shared components live in `components/ui/`
- [ ] No prop drilling beyond 2 levels (use context or co-location)

## Data Checklist
- [ ] All new tables have `id`, `user_id`, `created_at`
- [ ] All new tables have RLS enabled
- [ ] No raw SQL strings with user input (use parameterised queries)
- [ ] Supabase client used correctly (server vs client)

## Docs Checklist
- [ ] `database-schema.md` updated if schema changed
- [ ] `page-specs.md` updated if page behaviour changed
- [ ] `component-library.md` updated if new shared components added
- [ ] `alerts.md` updated if new alerts added

## Final Step
Run TypeScript check:
```
npx tsc --noEmit
```
Fix all errors before shipping.

Reviewing: $ARGUMENTS
