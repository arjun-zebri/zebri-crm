---
description: Create a new UI component following the Zebri design system
---

@.claude/docs/component-library.md
@.claude/docs/frontend-design.md

You are creating a new UI component for Zebri CRM. Follow these rules exactly:

## Before Creating — Check First
1. Does this component already exist in `components/ui/`? Run a search before writing.
2. Is it a shared/reusable component → `components/ui/[name].tsx`
3. Is it specific to one page → co-locate it next to that page file

## Component Rules
- Tailwind only — no inline styles, no CSS modules
- Icons: always `strokeWidth={1.5}` from lucide-react
- Buttons: `rounded-xl`, never `rounded-full`
- No native `<select>` — use the custom Select component
- Interactive elements need `cursor-pointer`
- All text (labels, placeholders, values) uses `text-sm`

## Props Pattern
```tsx
interface ComponentNameProps {
  // explicit, typed props
}

export function ComponentName({ ... }: ComponentNameProps) {
  // ...
}
```

## Checklist
- [ ] Does a similar component already exist?
- [ ] Is the location correct (ui/ vs co-located)?
- [ ] Does it follow text-sm everywhere?
- [ ] No rounded-full on interactive elements?
- [ ] Icons have strokeWidth={1.5}?
- [ ] No native select/button?

Now create the component: $ARGUMENTS
