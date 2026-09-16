-- Proposal Layout v2, Phase 1 (spec docs/superpowers/specs/2026-09-16-proposal-layout-v2-design.md §2.3).
--
-- Adds the v2 storage: named templates per user, a per-proposal layout
-- copy, account-level page settings, a 30-day backup slot for the v1
-- branding tree, and an anon RPC that serves the layout for a share token.
-- Nothing here drops or rewrites v1 data; the app migrates lazily.
-- Replay-clean: every statement is `if not exists` / `or replace`.

-- ── proposal_templates ──────────────────────────────────────────────────
create table if not exists public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  layout jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposal_templates_user_id_idx on public.proposal_templates(user_id);
-- One default per user; the partial unique index is what the app's
-- "set as default" relies on (the app clears the old one first, then sets
-- the new one, as two statements, not one transaction).
create unique index if not exists proposal_templates_one_default_idx
  on public.proposal_templates(user_id) where is_default;

alter table public.proposal_templates enable row level security;
drop policy if exists proposal_templates_select on public.proposal_templates;
drop policy if exists proposal_templates_insert on public.proposal_templates;
drop policy if exists proposal_templates_update on public.proposal_templates;
drop policy if exists proposal_templates_delete on public.proposal_templates;
create policy proposal_templates_select on public.proposal_templates for select using (auth.uid() = user_id);
create policy proposal_templates_insert on public.proposal_templates for insert with check (auth.uid() = user_id);
create policy proposal_templates_update on public.proposal_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy proposal_templates_delete on public.proposal_templates for delete using (auth.uid() = user_id);

-- ── proposal_settings (one row per user) ────────────────────────────────
create table if not exists public.proposal_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_enabled boolean not null default false,
  allow_download boolean not null default true,
  section_nav boolean not null default false,
  expiry_days integer not null default 14 check (expiry_days between 1 and 365),
  deposit_percent integer not null default 30 check (deposit_percent between 0 and 100),
  link_preview jsonb,
  updated_at timestamptz not null default now()
);
alter table public.proposal_settings enable row level security;
drop policy if exists proposal_settings_select on public.proposal_settings;
drop policy if exists proposal_settings_insert on public.proposal_settings;
drop policy if exists proposal_settings_update on public.proposal_settings;
drop policy if exists proposal_settings_delete on public.proposal_settings;
create policy proposal_settings_select on public.proposal_settings for select using (auth.uid() = user_id);
create policy proposal_settings_insert on public.proposal_settings for insert with check (auth.uid() = user_id);
create policy proposal_settings_update on public.proposal_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy proposal_settings_delete on public.proposal_settings for delete using (auth.uid() = user_id);

-- ── proposals: the per-proposal copy ────────────────────────────────────
alter table public.proposals add column if not exists layout jsonb;
alter table public.proposals add column if not exists template_id uuid references public.proposal_templates(id) on delete set null;
create index if not exists proposals_template_id_idx on public.proposals(template_id);

-- ── user_branding: 30-day backup of the v1 proposal tree ────────────────
alter table public.user_branding add column if not exists blocks_proposal_v1_backup jsonb;
alter table public.user_branding add column if not exists blocks_proposal_v1_backup_at timestamptz;

-- ── get_public_proposal_layout ──────────────────────────────────────────
-- The v2 read for the couple's page. Token-gated like get_public_proposal
-- but with no side effects, so the page can call both. Returns the
-- proposal's OWN layout only, else null (the page then renders the v1
-- tree from get_public_proposal). Phase 1 never writes `proposals.layout`
-- (Phase 4 does), so this stays null for every proposal until then: a
-- template is a named layout an MC edits, not something a couple's link
-- serves directly, so there is no default-template fallback here.
-- `page.passwordHash` is never a public field: the page-password gate is
-- checked server-side (the RPC caller never needs the hash to render),
-- so it is stripped with `#-` before the jsonb leaves this function. `#-`
-- on a null jsonb yields null, so the null-layout / null-token cases are
-- unaffected (verified: `select null::jsonb #- '{page,passwordHash}'`
-- returns null).
create or replace function public.get_public_proposal_layout(token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select p.layout #- '{page,passwordHash}'
  from public.proposals p
  where p.share_token = token and p.share_token_enabled = true;
$$;
revoke all on function public.get_public_proposal_layout(uuid) from public;
grant execute on function public.get_public_proposal_layout(uuid) to anon, authenticated;
