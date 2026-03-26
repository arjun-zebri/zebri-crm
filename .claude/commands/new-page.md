---
description: Scaffold a new page following Zebri conventions
---

@.claude/docs/page-specs.md
@.claude/docs/frontend-design.md
@.claude/docs/component-library.md

You are scaffolding a new page for Zebri CRM. Follow these rules exactly:

## Route Group Rules
- Authenticated pages → `app/(dashboard)/[route]/page.tsx`
- Auth pages (login, signup, etc.) → `app/(auth)/[route]/page.tsx`

## File Structure to Create
```
app/(dashboard)/[route]/
├── page.tsx              ← orchestrator only
├── [name]-section.tsx    ← one file per logical section
└── [name]-section.tsx
```

## Page File Rules
- `page.tsx` fetches data (server component or useEffect) and composes sections
- No form logic, no mutation handlers, no complex UI in `page.tsx`
- Each section component owns its own state, handlers, and side effects

## Checklist Before Writing Code
- [ ] Does this page already exist? Check `app/(dashboard)/` first
- [ ] What sections does this page need? List them before writing
- [ ] Does each section have a clear, single responsibility?
- [ ] Is there an empty state for when there's no data?

## Design System Checklist
- [ ] Page title uses `text-3xl font-semibold`
- [ ] All body text uses `text-sm`
- [ ] Buttons use components from `components/ui/` — not native `<button>`
- [ ] No `rounded-full` on buttons
- [ ] Icons use `strokeWidth={1.5}`
- [ ] No inline styles

Now scaffold the page: $ARGUMENTS
