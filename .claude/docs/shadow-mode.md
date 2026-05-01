# Shadow Mode

Shadow Mode lets a Zebri admin sign into another user's account, see exactly what that user sees, and perform any action on their behalf. It is intended for support, debugging, and demos.

> Shadow Mode is **not logged**. There is no audit trail by design — keep it simple. Admins are trusted; the role is granted manually in Supabase and is held by the founder only at MVP stage.

---

## Who can use Shadow Mode

Only users with `user_metadata.account_type = "admin"`.

Admins are granted manually via the Supabase dashboard:

1. Open Supabase → Authentication → Users
2. Find the user, edit their `user_metadata`
3. Set `account_type` to `"admin"`

There is no UI for promoting/demoting admins. This is intentional for MVP.

---

## Entry point — `/admin`

A new route, gated by middleware. Non-admins hitting `/admin` are redirected to `/`.

Admins see an extra **Admin** item in the sidebar (Shield icon, below Settings).

### `/admin` page layout

- Page title: **Admin**
- Single section: **Users** (table)

### Users table columns

| Column | Source |
|---|---|
| Name | `user_metadata.display_name` |
| Business | `user_metadata.business_name` |
| Email | `auth.users.email` |
| Action | "Enter Shadow Mode" button |

Search bar above the table filters across name / business / email (client-side, since admin will likely have <1000 users for a long time).

No sorting, pagination, subscription status, sign-in dates, or other columns in MVP — keep it minimal.

### Entering Shadow Mode

Clicking "Enter Shadow Mode" on a row:

1. Confirms with a small dialog: *"Enter Shadow Mode for Jane Doe?"*
2. Calls server action `enterShadow(targetUserId)`.
3. Server uses Supabase Admin API (`supabase.auth.admin.generateLink` with `type: "magiclink"` or `auth.admin.signInWithUserId` if available; otherwise mints a session via service-role client) to swap the admin's session cookie for one belonging to the target user.
4. The admin's original `user_id` is stashed in a separate signed cookie: `zebri_shadow_admin_id`.
5. Browser is redirected to `/` — the dashboard now renders as the target user.

---

## In-Shadow-Mode UI

### Top banner (always visible while shadowed)

A persistent strip at the top of every page in the `(dashboard)` route group:

```
┌──────────────────────────────────────────────────────────────────┐
│  Shadow Mode  ·  Viewing as Jane Doe (jane@example.com)   [Exit] │
└──────────────────────────────────────────────────────────────────┘
```

- Background: subtle amber (`bg-amber-50`), bottom border (`border-amber-200`).
- Height: 40px desktop, 56px mobile (wraps if needed).
- Shifts the sidebar and main content down by the banner height (no overlap).
- "Exit" button calls `exitShadow()`.

### Sidebar

No additional badge — the banner is enough. Sidebar continues to show the *target user's* name/email in the footer (because the session is genuinely theirs).

### Detection

Components don't need to check shadow state for normal rendering — the session is the target user's, so all RLS, queries, and UI behave as if that user logged in. The only component that consults shadow state is the banner itself, which reads the `zebri_shadow_admin_id` cookie via a server component.

---

## Exiting Shadow Mode

Triggered by the "Exit" button in the banner, or by visiting `/exit-shadow`.

1. Calls server action `exitShadow()`.
2. Server reads `zebri_shadow_admin_id` cookie, then mints a fresh session for that admin and replaces the cookie.
3. Clears `zebri_shadow_admin_id`.
4. Redirects to `/admin`.

If the admin signs out without exiting, the next time they sign back in normally there is no leftover state — the `zebri_shadow_admin_id` cookie is short-lived (24h) and is also cleared on any successful login flow.

---

## RLS implications

Because Shadow Mode swaps the session cookie for the target user, **all existing RLS policies just work**. The DB sees `auth.uid()` as the target user, queries return the target user's rows, and writes attribute correctly to the target user.

The pre-existing `account_type = 'admin'` RLS bypass policies are **not** used during Shadow Mode (the JWT in flight is the target user's, not the admin's). They remain on the books for direct admin queries (e.g., the `/admin` page reading `auth.users` via the service-role client).

The `/admin` page itself does **not** rely on RLS — listing users requires `supabase.auth.admin.listUsers()`, which is service-role only and runs from a server action.

---

## Server actions

All in `app/admin/actions.ts`:

| Action | Description |
|---|---|
| `listUsers(searchQuery?)` | Service-role call to `supabase.auth.admin.listUsers()`, returns `[{ id, email, display_name, business_name }]` |
| `enterShadow(targetUserId)` | Verifies caller is admin, mints target session, sets `zebri_shadow_admin_id` cookie |
| `exitShadow()` | Reads `zebri_shadow_admin_id`, restores admin session, clears cookie |

Every action begins with an `assertAdmin()` helper that re-reads the JWT and throws if `account_type !== 'admin'`. Trust nothing on the client side.

---

## Middleware changes

`middleware.ts` gains:

1. A check for `/admin/*` — if the user is not an admin, redirect to `/`.
2. The subscription paywall is **skipped** while `zebri_shadow_admin_id` cookie is present, because the admin should be able to see paywalled accounts (e.g., `expired` users).

No other middleware changes are needed — the auth refresh logic is unaffected.

---

## Edge cases

| Case | Behaviour |
|---|---|
| Admin closes the tab without exiting | `zebri_shadow_admin_id` cookie is `Max-Age=24h`, after which the banner stops rendering and the session simply remains as the target user. Signing out and back in returns the admin to their own account cleanly (the cookie is also cleared on any successful login flow). |
| Admin shadows themselves | Blocked at the server action — `if (adminId === targetId) throw`. |
| Target user logs in while being shadowed | No conflict — Supabase supports multiple active sessions per user. Both work. |
| Admin tries to enter Shadow Mode while already shadowing someone | The "Enter" action calls `exitShadow()` first if `zebri_shadow_admin_id` is set, then proceeds. |
| Admin's `account_type` is changed to `vendor` mid-shadow | Next request to `/admin/*` redirects them out. The active shadow session continues until they exit. |
| User deletes their account while being shadowed | The target session becomes invalid on the next request; the admin is bounced to `/login`. They re-authenticate as themselves. |

---

## What's explicitly out of scope (MVP)

- Audit logging of any kind (sessions or per-action) — intentionally not built
- Notifying users that their account was accessed
- Multiple admin tiers / granular permissions
- An admin UI for promoting/demoting admins
- Read-only Shadow Mode option
- Shadowing through API tokens (only browser sessions)
- Shadow Mode for the public portal (`/portal`, `/timeline`, `/quote`, `/invoice`, `/contract`) — those are unauthenticated by design and don't need it

---

## Verification

Once implemented (separate pass), the feature is verified by:

1. Manually setting `account_type = "admin"` for one test user in Supabase.
2. Logging in as that admin → confirm Admin sidebar item appears, `/admin` loads.
3. Clicking Enter Shadow Mode for a different test user → confirm banner shows and dashboard renders that user's couples/contacts/tasks.
4. Performing a write (create a couple) → confirm the new row's `user_id` matches the target user, not the admin.
5. Clicking Exit → confirm banner disappears and `/admin` reloads as the original admin.
6. As a non-admin, hitting `/admin` directly → confirm redirect to `/`.
7. Across desktop and mobile (Pixel 5, iPhone 12) per Zebri testing rules.
