# Settings Modal — Design Spec

**Date:** 2026-06-18
**Status:** Approved (design); implementation pending

## Goal

Convert Settings from a standalone full-page route into an overlay
**modal** with a left **side-tab** navigation, matching the visual
style of the Couple Profile overlay (`couple-profile.tsx`). Add two
new sections — **Privacy** and **Terms** — rendering inline legal copy
sourced from the marketing site.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Trigger / routing | **Intercepting route** — `/settings` stays a real URL, renders as an overlay modal |
| Direct `/settings` load (refresh / hard nav) | **Modal over the dashboard home** |
| Privacy / Terms content | **Inline full legal text**, sourced from `zebri.com.au/privacy` + `/terms` |
| Side tabs | **Icons** + existing 4 sections + Privacy + Terms |

## 1. Behaviour & routing

Next.js App Router **parallel + intercepting routes**:

- `app/(dashboard)/layout.tsx` gains a `@modal` parallel slot and
  renders `…{children}{modal}`.
- `app/(dashboard)/@modal/default.tsx` → returns `null` (renders
  nothing when not on `/settings`).
- `app/(dashboard)/@modal/(.)settings/page.tsx` → renders
  `<SettingsModal/>`. Intercepts **soft navigation** from the sidebar,
  so the page the user was on (Couples, Calendar, etc.) stays visible
  behind the modal.
- `app/(dashboard)/settings/page.tsx` → **hard-load / refresh
  fallback**: renders the dashboard home (`DashboardPage`) as the
  backdrop + `<SettingsModal/>` on top, so a direct hit on `/settings`
  shows the modal over the dashboard.
- **Sidebar unchanged** — its existing `Link href="/settings"` is what
  gets intercepted. No new client trigger needed.
- Close behaviour: backdrop click / `Esc` / close button →
  `router.back()`, falling back to `router.push('/')` when there is no
  history to pop.
- **Legacy redirects preserved** (currently in `settings/page.tsx`):
  `?tab=branding` and `?tab=portal` → `/branding`; `?tab=templates`
  → `/templates`.

## 2. Modal shell (matches couple-profile)

Mirrors the couple-profile overlay exactly:

- Backdrop: `fixed inset-0 bg-black/40 backdrop-blur-sm z-50
  animate-fade-in`.
- Surface: centered `bg-white rounded-2xl shadow-xl`,
  `sm:w-[90vw] sm:max-w-[1100px] h-full sm:h-[90vh]`,
  `flex flex-col overflow-hidden animate-modal-in`.
- Header bar: **"Settings"** title (left) + close `X` (right), same
  padding/border as the couple-profile header.
- Body: `flex flex-col sm:flex-row overflow-hidden` → left side-nav +
  scrollable content panel.

(`max-w-[1100px]` instead of couple-profile's `1400px` — settings
content is narrower; otherwise identical sizing.)

## 3. Side-tab nav

New `settings-nav.tsx`, modeled on `couple-profile-nav.tsx`:

- Desktop: 200px vertical sidebar, `border-r`, active item
  `bg-gray-100 text-gray-900 font-medium`.
- Mobile (≤ sm): horizontal scrollable pill row pinned under header.
- Stateless — parent owns `activeSection` + nav-item list.

Tabs (Lucide icons, `strokeWidth={1.5}`):

| Tab | id | Icon |
|---|---|---|
| Personal Info | `personal-info` | `User` |
| Account | `account` | `Bell` |
| Plans & Billing | `billing` | `CreditCard` |
| Receive Payments | `payments` | `Landmark` |
| Privacy | `privacy` | `Shield` |
| Terms | `terms` | `FileText` |

Active tab is driven by `?tab=` (default `personal-info`); switching
tabs uses `router.replace('/settings?tab=<id>')` so it stays within
the intercepted modal and is deep-linkable.

## 4. Content

Existing section components are **reused unchanged**:
`PersonalInfoSection`, `AccountSection`, `BillingSection`,
`PaymentSettingsSection`. They are fed by the same data load the
current page does (`supabase.auth.getUser()` + `@/lib/auth/
entitlements` helpers).

Two new sections:

- `privacy-section.tsx` — inline Zebri Privacy Policy copy, with a
  "Last updated" line and a canonical "View the latest at
  zebri.com.au/privacy" link.
- `terms-section.tsx` — inline Zebri Terms of Service copy, same
  treatment, linking to zebri.com.au/terms.

## 5. Files

**New**

- `app/(dashboard)/@modal/default.tsx`
- `app/(dashboard)/@modal/(.)settings/page.tsx`
- `app/(dashboard)/settings/settings-modal.tsx` (orchestrator: shell +
  data load + nav/body composition)
- `app/(dashboard)/settings/settings-nav.tsx`
- `app/(dashboard)/settings/settings-body.tsx` (section switch)
- `app/(dashboard)/settings/privacy-section.tsx`
- `app/(dashboard)/settings/terms-section.tsx`

**Modified**

- `app/(dashboard)/layout.tsx` (add `@modal` slot)
- `app/(dashboard)/settings/page.tsx` (becomes the hard-load fallback:
  `DashboardPage` backdrop + `SettingsModal`; keeps legacy redirects)

Each file kept ≤ ~150 lines per the component rule (the nav/body
split exists to satisfy this).

## Open items / flags

1. **Legal text fidelity.** Automated fetch of the live pages returned
   *paraphrased* (privacy) and *summarized* (terms) content — not safe
   to ship verbatim as legal copy. The sections will be structured
   faithfully, but the exact text must be confirmed/pasted by the user
   before shipping. Not a design blocker.
2. **Styling scope.** The existing section components use raw `gray-*`
   Tailwind + native form controls (legacy, pre-token). They are kept
   as-is to stay focused on the modal conversion; retrofitting them to
   design tokens is a separate page-hardening task.

## Out of scope

- Retrofitting existing section components to design tokens/primitives.
- Search box in the side-nav (present in the reference screenshot, not
  requested).
- Avatar upload / new profile fields from the reference screenshot.
