-- Proposals — packages → send → accept → invoice (Phase A).
--
-- Replaces the quotes feature (spec: .claude/docs/proposals.md). A
-- proposal offers a couple 1–N package OPTIONS; each option is a
-- SNAPSHOT of a package's items and commercial terms (deposit %,
-- GST-inclusive flag, weekend loading) taken at apply time, so later
-- package edits never change sent proposals. The couple picks one
-- option plus add-ons on the public page; acceptance records exactly
-- what was agreed, which is what invoice generation later references.
--
-- Quotes remain untouched in this migration — they coexist until the
-- Phase G/H removal. Not destructive.

-- ────────────────────────────────────────────────────────────────
-- Tables
-- ────────────────────────────────────────────────────────────────

create table proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  proposal_number text not null,
  -- draft | sent | accepted | declined ("expired" is display-only,
  -- derived from expires_at, so a late acceptance stays possible if
  -- the MC extends the date).
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined')),
  notes text,
  expires_at date,
  share_token uuid not null default gen_random_uuid(),
  -- Off until the MC sends — the send action's job to enable.
  share_token_enabled boolean not null default false,
  -- Set by accept_proposal: which option + which add-on ticks.
  accepted_option_id uuid,
  accepted_addon_selection jsonb,
  accepted_at timestamptz,
  email_sent_at timestamptz,
  -- Denormalised list display: the primary option's total before
  -- acceptance, the accepted selection's total after.
  subtotal numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proposal_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  -- Customer-facing label; pre-filled from the package name, editable.
  title text not null,
  description text,
  -- Provenance only (conversion stats); never feeds rendering.
  source_package_id uuid references packages(id) on delete set null,
  -- Snapshot of the package's commercial terms at apply time. These
  -- carry through to invoice generation (deposit schedule + GST),
  -- fixing the old quote→invoice terms loss.
  deposit_percent numeric(5,2),
  gst_inclusive boolean not null default true,
  weekend_loading_percent numeric(5,2),
  -- Base (non-add-on) items total, denormalised for chooser cards.
  subtotal numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table proposal_option_items (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references proposal_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Quantities are pre-flattened at apply time ("2 × Extra hour");
  -- amount is the line total.
  description text not null,
  amount numeric(10,2) not null,
  -- True for optional add-ons the couple can tick on the public page.
  is_addon boolean not null default false,
  -- The MC's pre-tick (only meaningful when is_addon).
  default_included boolean not null default false,
  position integer not null,
  created_at timestamptz not null default now()
);

-- accepted_option_id FK added after proposal_options exists (the two
-- tables reference each other).
alter table proposals
  add constraint proposals_accepted_option_id_fkey
  foreign key (accepted_option_id) references proposal_options(id) on delete set null;

-- ────────────────────────────────────────────────────────────────
-- RLS + indexes
-- ────────────────────────────────────────────────────────────────

alter table proposals enable row level security;
alter table proposal_options enable row level security;
alter table proposal_option_items enable row level security;

create policy "Users manage own proposals" on proposals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own proposal_options" on proposal_options
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own proposal_option_items" on proposal_option_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index proposals_user_id_idx on proposals(user_id);
create index proposals_couple_id_idx on proposals(couple_id);
create index proposals_share_token_idx on proposals(share_token);
create index proposal_options_proposal_id_idx on proposal_options(proposal_id);
create index proposal_options_source_package_id_idx on proposal_options(source_package_id);
create index proposal_option_items_option_id_idx on proposal_option_items(option_id);

-- keep updated_at fresh (same touch pattern as email_templates)
create or replace function public.touch_proposals_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.touch_proposals_updated_at();

-- ────────────────────────────────────────────────────────────────
-- Provenance FKs on documents generated from proposals
-- ────────────────────────────────────────────────────────────────

alter table invoices
  add column if not exists proposal_id uuid references proposals(id) on delete set null;
create index if not exists invoices_proposal_id_idx on invoices(proposal_id);

alter table contracts
  add column if not exists proposal_id uuid references proposals(id) on delete set null;
create index if not exists contracts_proposal_id_idx on contracts(proposal_id);

-- ────────────────────────────────────────────────────────────────
-- Number generator (sequential per user, PR-001)
-- ────────────────────────────────────────────────────────────────

create or replace function generate_proposal_number(p_user_id uuid)
returns text language plpgsql as $$
declare
  next_num integer;
begin
  select coalesce(
    max(cast(regexp_replace(proposal_number, '[^0-9]', '', 'g') as integer)),
    0
  ) + 1
  into next_num
  from proposals
  where user_id = p_user_id;
  return 'PR-' || lpad(next_num::text, 3, '0');
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- Public RPCs (SECURITY DEFINER, anon)
--
-- Field selection per security.md: no user_id, no share_token in any
-- payload. Branding merges via _user_branding() (20260514000000).
-- ────────────────────────────────────────────────────────────────

create or replace function get_public_proposal(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'proposal_number', p.proposal_number,
    'status', p.status,
    'notes', p.notes,
    'expires_at', p.expires_at,
    'accepted_at', p.accepted_at,
    'accepted_option_id', p.accepted_option_id,
    'accepted_addon_selection', p.accepted_addon_selection,
    'couple_name', c.name,
    'business_name', (
      select u.raw_user_meta_data->>'business_name'
      from auth.users u
      where u.id = p.user_id
    ),
    'options', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', po.id,
            'title', po.title,
            'description', po.description,
            'deposit_percent', po.deposit_percent,
            'gst_inclusive', po.gst_inclusive,
            'subtotal', po.subtotal,
            'position', po.position,
            'items', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', poi.id,
                    'description', poi.description,
                    'amount', poi.amount,
                    'is_addon', poi.is_addon,
                    'default_included', poi.default_included,
                    'position', poi.position
                  ) order by poi.position
                ),
                '[]'::jsonb
              )
              from proposal_option_items poi
              where poi.option_id = po.id
            )
          ) order by po.position
        ),
        '[]'::jsonb
      )
      from proposal_options po
      where po.proposal_id = p.id
    )
  ) || coalesce(_user_branding(p.user_id), '{}'::jsonb)
  into result
  from proposals p
  join couples c on c.id = p.couple_id
  where p.share_token = token
    and p.share_token_enabled = true;

  return result;
end;
$$;

-- accept_proposal — the money moment. Validates the couple's choice
-- against this proposal's own options/add-ons (anti-confused-deputy:
-- ids from other proposals are rejected), then atomically records the
-- selection, advances the couple, and creates the follow-up task. The
-- accepted_at flip fires the proposal automation trigger below.
create or replace function accept_proposal(
  token uuid,
  chosen_option_id uuid,
  addon_selection jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  opt record;
  couple record;
  sel_key text;
  sel_total numeric(10,2);
begin
  select * into p
  from proposals
  where share_token = token and share_token_enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if p.status in ('accepted', 'declined') then
    return '{"error":"already_actioned"}'::jsonb;
  end if;

  if p.expires_at is not null and p.expires_at < current_date then
    return '{"error":"expired"}'::jsonb;
  end if;

  select * into opt
  from proposal_options
  where id = chosen_option_id and proposal_id = p.id;

  if not found then
    return '{"error":"invalid_option"}'::jsonb;
  end if;

  -- Every selection key must be an add-on item OF THE CHOSEN OPTION.
  for sel_key in select jsonb_object_keys(coalesce(addon_selection, '{}'::jsonb))
  loop
    if not exists (
      select 1 from proposal_option_items
      where id = sel_key::uuid and option_id = opt.id and is_addon = true
    ) then
      return '{"error":"invalid_selection"}'::jsonb;
    end if;
  end loop;

  -- Accepted total = base items + ticked add-ons.
  select coalesce(sum(poi.amount), 0) into sel_total
  from proposal_option_items poi
  where poi.option_id = opt.id
    and (
      poi.is_addon = false
      or coalesce((addon_selection ->> poi.id::text)::boolean, false)
    );

  update proposals
  set status = 'accepted',
      accepted_option_id = opt.id,
      accepted_addon_selection = coalesce(addon_selection, '{}'::jsonb),
      accepted_at = now(),
      subtotal = sel_total
  where id = p.id;

  select * into couple from couples where id = p.couple_id;

  -- Advance couple status (never regress past confirmed/paid/complete).
  update couples
  set status = 'confirmed'
  where id = p.couple_id
    and status not in ('confirmed', 'paid', 'complete');

  insert into tasks (user_id, title, due_date, status, related_couple_id)
  values (
    p.user_id,
    'Proposal accepted — confirm booking for ' || couple.name,
    current_date,
    'todo',
    p.couple_id
  );

  return jsonb_build_object(
    'success', true,
    'chosen_option_id', opt.id,
    'total', sel_total
  );
end;
$$;

create or replace function decline_proposal(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  select * into p
  from proposals
  where share_token = token and share_token_enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if p.status in ('accepted', 'declined') then
    return '{"error":"already_actioned"}'::jsonb;
  end if;

  update proposals set status = 'declined' where id = p.id;

  return '{"success":true}'::jsonb;
end;
$$;

grant execute on function get_public_proposal(uuid) to anon;
grant execute on function accept_proposal(uuid, uuid, jsonb) to anon;
grant execute on function decline_proposal(uuid) to anon;

-- ────────────────────────────────────────────────────────────────
-- Automation events (same pattern as tg_quotes_emit_lifecycle)
-- ────────────────────────────────────────────────────────────────

create or replace function public.tg_proposals_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- accepted_at null → not-null is the acceptance moment; payload
    -- carries the chosen option + selection so downstream actions
    -- (create_invoice_from_proposal) don't need a second read.
    if new.accepted_at is not null and old.accepted_at is null then
      perform public.emit_automation_event(
        new.user_id,
        'proposals',
        new.id,
        'proposal_accepted',
        jsonb_build_object(
          'proposal_id', new.id,
          'couple_id', new.couple_id,
          'proposal_number', new.proposal_number,
          'subtotal', new.subtotal,
          'chosen_option_id', new.accepted_option_id,
          'addon_selection', new.accepted_addon_selection,
          'accepted_at', new.accepted_at
        ),
        new.couple_id
      );
    end if;

    -- share_token_enabled false → true is the "sent" moment.
    if new.share_token_enabled = true and coalesce(old.share_token_enabled, false) = false then
      perform public.emit_automation_event(
        new.user_id,
        'proposals',
        new.id,
        'proposal_sent',
        jsonb_build_object(
          'proposal_id', new.id,
          'couple_id', new.couple_id,
          'proposal_number', new.proposal_number,
          'subtotal', new.subtotal
        ),
        new.couple_id
      );
    end if;

    if new.status = 'declined' and old.status is distinct from 'declined' then
      perform public.emit_automation_event(
        new.user_id,
        'proposals',
        new.id,
        'proposal_declined',
        jsonb_build_object(
          'proposal_id', new.id,
          'couple_id', new.couple_id
        ),
        new.couple_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proposals_emit_lifecycle on public.proposals;
create trigger proposals_emit_lifecycle
  after update on public.proposals
  for each row execute function public.tg_proposals_emit_lifecycle();
