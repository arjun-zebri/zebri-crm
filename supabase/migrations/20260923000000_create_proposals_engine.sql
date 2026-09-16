-- Proposals engine, Phase A (spec: docs/superpowers/specs/2026-09-12-proposals-engine-design.md).
--
-- A proposal offers a couple 1-3 package OPTIONS. Each option is a snapshot
-- of a package's items and commercial terms at save time so later package
-- edits never change a sent proposal (D3, D12). Acceptance, events, and the
-- lifecycle trigger arrive in Phases C-E; this file is the storage + the two
-- RPCs the dashboard and public page need.
--
-- Not destructive. Deployed by CI `supabase db push` only.

-- ── Tables ──────────────────────────────────────────────────────────────

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  proposal_number text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  -- TipTap JSON. Normalised client-side with toPlainJSON before the action.
  intro_note jsonb,
  -- { imagePath?, videoPath?, embedUrl? } (rendered from Phase B).
  hero_override jsonb,
  expires_at date,
  -- Used when no payment schedule is chosen (Phase C invoice generation).
  deposit_percent numeric(5,2),
  payment_schedule_id uuid references public.payment_schedules(id) on delete set null,
  contract_template_id uuid references public.contract_templates(id) on delete set null,
  -- Bumped when a sent proposal is edited (D13: latest wins).
  version integer not null default 1,
  share_token uuid not null default gen_random_uuid() unique,
  -- Off until the MC sends; the send route's job to enable.
  share_token_enabled boolean not null default false,
  email_sent_at timestamptz,
  first_viewed_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  accepted_option_id uuid,
  accepted_addon_selection jsonb,
  accepted_at timestamptz,
  declined_at timestamptz,
  declined_reason text,
  declined_message text,
  contract_id uuid references public.contracts(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposal_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  -- Provenance for conversion stats only; never feeds rendering.
  source_package_id uuid references public.packages(id) on delete set null,
  pricing_mode text not null default 'itemised'
    check (pricing_mode in ('itemised', 'single')),
  fixed_price numeric(10,2),
  gst_inclusive boolean not null default true,
  weekend_loading_percent numeric(5,2),
  is_popular boolean not null default false,
  -- Base (non add-on) total, denormalised for list and chooser cards.
  subtotal numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.proposal_option_items (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.proposal_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  note text,
  amount numeric(10,2) not null,
  quantity numeric(8,2) not null default 1,
  is_addon boolean not null default false,
  default_included boolean not null default true,
  position integer not null,
  created_at timestamptz not null default now()
);

-- The two tables reference each other; add the FK once options exist.
-- This means proposals and proposal_options now have TWO FK paths between
-- them (the other is proposal_options.proposal_id -> proposals.id), so
-- PostgREST cannot infer which one an embed means (PGRST201): every embed
-- of proposal_options from proposals must hint the relationship, e.g.
-- `proposal_options!proposal_options_proposal_id_fkey(...)`.
alter table public.proposals
  add constraint proposals_accepted_option_id_fkey
  foreign key (accepted_option_id) references public.proposal_options(id) on delete set null;

-- Provenance on the documents a proposal generates (D17).
alter table public.contracts
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;
alter table public.invoices
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

-- ── Indexes (every FK) ──────────────────────────────────────────────────

create index proposals_user_id_idx on public.proposals(user_id);
create index proposals_couple_id_idx on public.proposals(couple_id);
create index proposals_event_id_idx on public.proposals(event_id);
create index proposals_payment_schedule_id_idx on public.proposals(payment_schedule_id);
create index proposals_contract_template_id_idx on public.proposals(contract_template_id);
create index proposals_contract_id_idx on public.proposals(contract_id);
create index proposals_invoice_id_idx on public.proposals(invoice_id);
create index proposals_accepted_option_id_idx on public.proposals(accepted_option_id);
create index proposal_options_proposal_id_idx on public.proposal_options(proposal_id);
create index proposal_options_user_id_idx on public.proposal_options(user_id);
create index proposal_options_source_package_id_idx on public.proposal_options(source_package_id);
create index proposal_option_items_option_id_idx on public.proposal_option_items(option_id);
create index proposal_option_items_user_id_idx on public.proposal_option_items(user_id);
create index contracts_proposal_id_idx on public.contracts(proposal_id);
create index invoices_proposal_id_idx on public.invoices(proposal_id);

-- ── updated_at ──────────────────────────────────────────────────────────

create or replace function public.touch_proposals_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.touch_proposals_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Owner-only on every verb. Child tables also prove the parent is the
-- caller's: FKs are validated with elevated privileges and ignore RLS, so
-- without the EXISTS a user could attach rows to another MC's proposal.

create or replace function public._owns_proposal(p_proposal_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from proposals where id = p_proposal_id and user_id = auth.uid());
$$;

create or replace function public._owns_proposal_option(p_option_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from proposal_options where id = p_option_id and user_id = auth.uid());
$$;

alter table public.proposals enable row level security;
alter table public.proposal_options enable row level security;
alter table public.proposal_option_items enable row level security;

-- with check also proves parentage: FKs are validated with elevated
-- privileges and ignore RLS, so without the EXISTS checks a user could
-- point a proposal at another MC's couple (or event) row. get_public_proposal
-- is SECURITY DEFINER and joins couples straight off proposals.couple_id, so
-- a spoofed couple_id here would leak another MC's couple through the
-- public share link. The same holds for every other pointer the public
-- RPCs follow (Phase C): contract_id feeds get_public_proposal's
-- pending_contract (locked HTML + the couple's sign token) and
-- accept_proposal's draft delete; invoice_id feeds the pay step;
-- contract_template_id is cloned into the draft contract;
-- payment_schedule_id decides the invoice stages. Each must be owned by
-- the same MC, or MC A could read, delete or clone MC B's rows through
-- A's own share link. The RPCs owner-match these again as defence in depth.
create policy "proposals_user_isolation" on public.proposals
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from couples c where c.id = couple_id and c.user_id = auth.uid())
    and (event_id is null or exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid()))
    and (contract_id is null or exists (select 1 from contracts c where c.id = contract_id and c.user_id = auth.uid()))
    and (invoice_id is null or exists (select 1 from invoices i where i.id = invoice_id and i.user_id = auth.uid()))
    and (contract_template_id is null or exists (select 1 from contract_templates t where t.id = contract_template_id and t.user_id = auth.uid()))
    and (payment_schedule_id is null or exists (select 1 from payment_schedules s where s.id = payment_schedule_id and s.user_id = auth.uid()))
  );

create policy "proposal_options_user_isolation" on public.proposal_options
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and _owns_proposal(proposal_id));

create policy "proposal_option_items_user_isolation" on public.proposal_option_items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and _owns_proposal_option(option_id));

-- ── Number generator (PR-001, sequential per user) ─────────────────────
-- Same shape as generate_invoice_number (20260406000000): nullif guards a
-- number with no digits so the cast cannot throw.

create or replace function public.generate_proposal_number(p_user_id uuid)
returns text language plpgsql as $$
declare
  next_num integer;
begin
  select coalesce(
    max(cast(nullif(regexp_replace(proposal_number, '[^0-9]', '', 'g'), '') as integer)),
    0
  ) + 1
  into next_num
  from proposals
  where user_id = p_user_id;
  return 'PR-' || lpad(next_num::text, 3, '0');
end;
$$;

-- ── Public RPC (SECURITY DEFINER, anon) ─────────────────────────────────
-- Field selection per security.md: no user_id, no share_token. Branding
-- merges via _user_branding(); the block tree via _user_branding_blocks
-- (empty until Phase B registers the surface). `expired` is derived so the
-- page never trusts a stale status column. View counting is stamped here
-- because the page is a server component with no session: the first read
-- of a `sent` proposal is the "opened" moment (D10 fills the rest in D).

create or replace function public.get_public_proposal(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  result jsonb;
begin
  select id into v_id
  from proposals
  where share_token = token and share_token_enabled = true;

  if v_id is null then
    return null;
  end if;

  update proposals
  set view_count = view_count + 1,
      last_viewed_at = now(),
      first_viewed_at = coalesce(first_viewed_at, now()),
      status = case when status = 'sent' then 'viewed' else status end
  where id = v_id;

  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'proposal_number', p.proposal_number,
    'status', p.status,
    'version', p.version,
    'intro_note', p.intro_note,
    'hero_override', p.hero_override,
    'expires_at', p.expires_at,
    'expired', (p.expires_at is not null and p.expires_at < current_date),
    'deposit_percent', p.deposit_percent,
    'accepted_option_id', p.accepted_option_id,
    'accepted_addon_selection', p.accepted_addon_selection,
    'accepted_at', p.accepted_at,
    'declined_at', p.declined_at,
    'couple_name', c.name,
    'event_date', c.event_date,
    'venue', c.venue,
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', po.id,
        'position', po.position,
        'title', po.title,
        'description', po.description,
        'pricing_mode', po.pricing_mode,
        'fixed_price', po.fixed_price,
        'gst_inclusive', po.gst_inclusive,
        'weekend_loading_percent', po.weekend_loading_percent,
        'is_popular', po.is_popular,
        'subtotal', po.subtotal,
        'items', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', poi.id,
            'description', poi.description,
            'note', poi.note,
            'amount', poi.amount,
            'quantity', poi.quantity,
            'is_addon', poi.is_addon,
            'default_included', poi.default_included,
            'position', poi.position
          ) order by poi.position), '[]'::jsonb)
          from proposal_option_items poi
          where poi.option_id = po.id
        )
      ) order by po.position), '[]'::jsonb)
      from proposal_options po
      where po.proposal_id = p.id
    ),
    'branding_blocks', _user_branding_blocks(p.user_id, 'proposal')
  ) || coalesce(_user_branding(p.user_id), '{}'::jsonb)
  into result
  from proposals p
  join couples c on c.id = p.couple_id
  where p.id = v_id;

  return result;
end;
$$;

grant execute on function public.get_public_proposal(uuid) to anon;
