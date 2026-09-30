-- R4: cross-proposal analytics for the /proposals page.
--
-- All four functions are SECURITY INVOKER: they read only through the
-- caller's RLS (proposals, proposal_options, invoices, proposal_events and
-- user_public_settings are all owner-scoped), so there is no tenant filter
-- to get wrong here and no second-factor ratchet entry (require-mfa-coverage
-- only tracks DEFINER).
--
-- Time to open is the first `opened` row in proposal_events, never
-- proposals.first_viewed_at: get_public_proposal stamps that column with
-- no owner check, so an MC previewing their own link would read as the
-- couple opening it, while record_proposal_events already drops the
-- owner's own events.

-- One row per proposal that has both an email_sent_at and an `opened` event.
create or replace function public._proposal_open_gaps()
returns table (proposal_id uuid, template_id uuid, gap_seconds numeric)
language sql stable security invoker set search_path = public
as $$
  select p.id, p.template_id,
         extract(epoch from (min(e.created_at) - p.email_sent_at))
  from public.proposals p
  join public.proposal_events e on e.proposal_id = p.id and e.type = 'opened'
  where p.email_sent_at is not null
  group by p.id, p.template_id, p.email_sent_at
  -- A negative gap is a link shared by hand before the email went out;
  -- it says nothing about how fast the email was opened.
  having min(e.created_at) >= p.email_sent_at
$$;

-- One row per accepted proposal with its revenue.
create or replace function public._proposal_revenue()
returns table (proposal_id uuid, template_id uuid, accepted_at timestamptz, revenue numeric)
language sql stable security invoker set search_path = public
as $$
  -- Same expression as R2's proposal_accepted `total`: the invoice the
  -- acceptance produced when there is one, else the chosen package.
  select p.id, p.template_id, p.accepted_at,
         coalesce(
           (select i.subtotal from public.invoices i where i.id = p.invoice_id and i.user_id = p.user_id),
           (select o.subtotal from public.proposal_options o where o.id = p.accepted_option_id and o.proposal_id = p.id),
           0)
  from public.proposals p
  where p.accepted_at is not null
$$;

-- One row per template the caller has sent at least once.
create or replace function public.proposal_template_performance()
returns table (template_id uuid, sent int, accepted int, revenue numeric, median_open_seconds numeric)
language sql stable security invoker set search_path = public
as $$
  select p.template_id,
         (count(*) filter (where p.status <> 'draft'))::int,
         (count(*) filter (where p.accepted_at is not null))::int,
         coalesce((select sum(r.revenue) from public._proposal_revenue() r where r.template_id = p.template_id), 0),
         (select percentile_cont(0.5) within group (order by g.gap_seconds)
            from public._proposal_open_gaps() g where g.template_id = p.template_id)::numeric
  from public.proposals p
  where p.template_id is not null
  group by p.template_id
  having count(*) filter (where p.status <> 'draft') > 0
$$;

-- Exactly one row for the caller (zeros and a null median when empty).
create or replace function public.proposal_account_summary()
returns table (sent int, accepted int, revenue_this_month numeric, median_open_seconds numeric)
language sql stable security invoker set search_path = public
as $$
  with tz as (
    -- The stored timezone is free text and `at time zone` raises on an
    -- unknown name, which would blank the whole strip for that MC, so a
    -- value is only trusted when Postgres knows it.
    select coalesce(
      (select s.timezone from public.user_public_settings s
        where s.user_id = auth.uid()
          and exists (select 1 from pg_timezone_names n where n.name = s.timezone)),
      'Australia/Sydney') as name
  ),
  month_start as (
    -- The MC's calendar month, not UTC's: "this month" on the 1st at 9am
    -- in Sydney must not still be last month.
    select (date_trunc('month', now() at time zone tz.name) at time zone tz.name) as at from tz
  )
  select
    (select count(*) from public.proposals p where p.status <> 'draft')::int,
    (select count(*) from public.proposals p where p.accepted_at is not null)::int,
    coalesce((select sum(r.revenue) from public._proposal_revenue() r, month_start m where r.accepted_at >= m.at), 0),
    (select percentile_cont(0.5) within group (order by g.gap_seconds) from public._proposal_open_gaps() g)::numeric
$$;

revoke all on function public._proposal_open_gaps() from public, anon;
revoke all on function public._proposal_revenue() from public, anon;
revoke all on function public.proposal_template_performance() from public, anon;
revoke all on function public.proposal_account_summary() from public, anon;
grant execute on function public._proposal_open_gaps() to authenticated;
grant execute on function public._proposal_revenue() to authenticated;
grant execute on function public.proposal_template_performance() to authenticated;
grant execute on function public.proposal_account_summary() to authenticated;
