---
description: Audit and fix UI for design system compliance
---

@.claude/docs/frontend-design.md
@.claude/docs/component-library.md

You are auditing Zebri CRM UI for design system compliance. Run through this checklist for the specified file(s):

## Audit Checklist

### Typography
- [ ] Any text larger than `text-sm` that isn't a heading? → Change to `text-sm`
- [ ] Page titles using `text-3xl font-semibold`?
- [ ] Section titles using `text-xl font-semibold`?

### Buttons & Interactive Elements
- [ ] Any `rounded-full` on buttons? → Change to `rounded-xl`
- [ ] Missing `cursor-pointer` on clickable elements?
- [ ] Using native `<button>` instead of the Button component?
- [ ] Using native `<select>` instead of the custom Select component?

### Icons
- [ ] All lucide-react icons have `strokeWidth={1.5}`?
- [ ] Icon sizes consistent (`w-4 h-4` for inline, `w-5 h-5` for standalone)?

### Tables
- [ ] Table headers use `text-xs uppercase tracking-wide text-gray-500`?
- [ ] Table rows have `hover:bg-gray-50`?
- [ ] No borders on individual cells (use row borders only)?

### Tabs
- [ ] Active tab: `border-b-2 border-black text-black`?
- [ ] Inactive tab: `text-gray-500 hover:text-gray-700`?
- [ ] Tab bar has `border-b border-gray-200`?

### General
- [ ] No inline styles (`style={{}}`)?
- [ ] Tailwind only — no CSS modules or external stylesheets?
- [ ] Consistent spacing using Tailwind scale (4, 6, 8, etc.)?

For each violation found, show: file:line → issue → fix.

Audit: $ARGUMENTS
