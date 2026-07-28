-- ────────────────────────────────────────────────────────────────
-- Couple-profile tab layout (Couples → couple profile modal)
--
-- Per-user, global-across-couples preference for how the couple
-- profile tab nav is arranged:
--   * hidden_tabs  — tab keys the MC has hidden (declutter; never
--                    includes 'overview', which stays the fallback).
--   * tab_order    — ordered tab keys. Empty means "use the code
--                    default order" (NAV_ITEMS in couple-profile.tsx).
--
-- This is a dashboard-only preference (the MC's own workspace), so it
-- lives on `user_public_settings` next to the other per-user dashboard
-- settings rather than on `user_branding` (which is couple-facing).
-- One row per user, existing owner + RLS shape already covers it.
-- ────────────────────────────────────────────────────────────────

alter table public.user_public_settings
  add column if not exists couple_profile_tabs_config jsonb not null
    default '{"hidden_tabs":[],"tab_order":[]}'::jsonb;
