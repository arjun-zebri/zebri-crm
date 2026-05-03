---
name: No native select elements
description: All dropdowns must be custom — never use native <select> anywhere in Zebri
type: feedback
---

Never use native `<select>` elements anywhere in Zebri. All dropdowns must be custom-built using a button + popover pattern (div/button + useState + click-outside handler).

**Why:** Native selects look out of place and break the minimal, modern SaaS aesthetic. User has had to say this multiple times.

**How to apply:** Any time a dropdown, filter pill, period selector, sort picker, or status selector is needed — build it custom. See the "Dropdowns — Custom Only" section in `.claude/docs/frontend-design.md` for the exact pattern.
