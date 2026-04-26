-- contracts table
create table contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  title text not null,
  contract_number text not null,
  status text not null default 'draft',
  content jsonb not null default '{}'::jsonb,
  locked_content jsonb,
  locked_content_html text,
  expires_at date,
  share_token uuid not null default gen_random_uuid(),
  share_token_enabled boolean not null default false,
  version integer not null default 1,
  email_sent_at timestamptz,
  last_reminder_at timestamptz,
  reminder_count integer not null default 0,
  signed_at timestamptz,
  signer_name text,
  signer_ip text,
  signer_user_agent text,
  declined_at timestamptz,
  declined_reason text,
  mc_signature_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- contract_templates table
create table contract_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  content jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table contracts enable row level security;
alter table contract_templates enable row level security;

create policy "Users manage own contracts" on contracts for all using (user_id = auth.uid());
create policy "Users manage own contract_templates" on contract_templates for all using (user_id = auth.uid());

-- Indexes
create index contracts_share_token_idx on contracts(share_token);
create index contracts_couple_id_idx on contracts(couple_id);
create index contracts_user_id_idx on contracts(user_id);
create index contracts_quote_id_idx on contracts(quote_id);
create index contracts_status_expires_idx on contracts(status, expires_at);
create index contract_templates_user_id_idx on contract_templates(user_id);

-- Contract number generator (sequential per user, e.g. CTR-001)
create or replace function generate_contract_number(p_user_id uuid)
returns text language plpgsql as $$
declare
  next_num integer;
begin
  select coalesce(
    max(cast(nullif(regexp_replace(contract_number, '[^0-9]', '', 'g'), '') as integer)),
    0
  ) + 1
  into next_num
  from contracts
  where user_id = p_user_id;
  return 'CTR-' || lpad(next_num::text, 3, '0');
end;
$$;

-- get_public_contract — anon-safe read via share token (reads locked content only)
create or replace function get_public_contract(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'contract_number', c.contract_number,
    'status', c.status,
    'locked_content_html', c.locked_content_html,
    'expires_at', c.expires_at,
    'signed_at', c.signed_at,
    'signer_name', c.signer_name,
    'signer_ip', c.signer_ip,
    'signer_user_agent', c.signer_user_agent,
    'declined_at', c.declined_at,
    'declined_reason', c.declined_reason,
    'mc_signature_name', c.mc_signature_name,
    'email_sent_at', c.email_sent_at,
    'couple_name', cp.name,
    'business_name', (
      select raw_user_meta_data->>'business_name'
      from auth.users where id = c.user_id
    ),
    'logo_url', (
      select raw_user_meta_data->>'logo_url'
      from auth.users where id = c.user_id
    ),
    'brand_color', (
      select COALESCE(raw_user_meta_data->>'brand_color', '#A7F3D0')
      from auth.users where id = c.user_id
    ),
    'tagline', (
      select raw_user_meta_data->>'tagline'
      from auth.users where id = c.user_id
    ),
    'show_contact_on_documents', (
      select (raw_user_meta_data->>'show_contact_on_documents')::boolean
      from auth.users where id = c.user_id
    ),
    'phone', (
      select raw_user_meta_data->>'phone'
      from auth.users where id = c.user_id
    ),
    'website', (
      select raw_user_meta_data->>'website'
      from auth.users where id = c.user_id
    ),
    'instagram_url', (
      select raw_user_meta_data->>'instagram_url'
      from auth.users where id = c.user_id
    ),
    'facebook_url', (
      select raw_user_meta_data->>'facebook_url'
      from auth.users where id = c.user_id
    )
  )
  into result
  from contracts c
  join couples cp on cp.id = c.couple_id
  where c.share_token = token
    and c.share_token_enabled = true
    and c.status <> 'revoked';

  return result;
end;
$$;

-- sign_contract — atomic: flip status, stamp signer, advance couple, spawn deposit invoice + task
create or replace function sign_contract(
  token uuid,
  p_signer_name text,
  p_signer_ip text,
  p_signer_user_agent text
)
returns jsonb language plpgsql security definer as $$
declare
  ct record;
  couple record;
  q record;
  new_invoice_id uuid;
  deposit_pct numeric;
  invoice_num text;
  item record;
begin
  select * into ct
  from contracts
  where share_token = token and share_token_enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if ct.status in ('signed', 'declined', 'revoked') then
    return '{"error":"already_actioned"}'::jsonb;
  end if;

  if ct.expires_at is not null and ct.expires_at < current_date then
    return '{"error":"expired"}'::jsonb;
  end if;

  if p_signer_name is null or length(trim(p_signer_name)) = 0 then
    return '{"error":"missing_signer_name"}'::jsonb;
  end if;

  -- Sign
  update contracts
  set status = 'signed',
      signed_at = now(),
      signer_name = trim(p_signer_name),
      signer_ip = p_signer_ip,
      signer_user_agent = p_signer_user_agent,
      updated_at = now()
  where id = ct.id;

  select * into couple from couples where id = ct.couple_id;

  -- Advance couple status to confirmed (never regress past confirmed/paid/complete)
  update couples
  set status = 'confirmed'
  where id = ct.couple_id
    and status not in ('confirmed', 'paid', 'complete');

  -- Auto-create deposit invoice if linked quote is accepted
  if ct.quote_id is not null then
    select * into q from quotes where id = ct.quote_id;
    if found and q.status = 'accepted' then
      deposit_pct := coalesce(
        (select (raw_user_meta_data->>'default_deposit_percent')::numeric from auth.users where id = ct.user_id),
        25
      );
      invoice_num := generate_invoice_number(ct.user_id);

      insert into invoices (
        user_id, couple_id, quote_id, invoice_number, title, status,
        subtotal, tax_rate, discount_type, discount_value, notes,
        deposit_percent, deposit_due_date, share_token_enabled
      ) values (
        ct.user_id,
        ct.couple_id,
        ct.quote_id,
        invoice_num,
        'Deposit for ' || couple.name,
        'draft',
        q.subtotal,
        coalesce(q.tax_rate, 0),
        q.discount_type,
        q.discount_value,
        q.notes,
        deposit_pct,
        current_date + interval '7 days',
        false
      ) returning id into new_invoice_id;

      for item in select * from quote_items where quote_id = ct.quote_id order by position loop
        insert into invoice_items (
          invoice_id, user_id, description, quantity, unit_price, amount, position
        ) values (
          new_invoice_id,
          ct.user_id,
          item.description,
          1,
          item.amount,
          item.amount,
          item.position
        );
      end loop;
    end if;
  end if;

  -- Follow-up task for the MC
  insert into tasks (user_id, title, due_date, status, related_couple_id)
  values (
    ct.user_id,
    'Contract signed by ' || couple.name || ' — review & send deposit invoice',
    current_date,
    'todo',
    ct.couple_id
  );

  return jsonb_build_object('success', true, 'invoice_id', new_invoice_id);
end;
$$;

-- decline_contract — anon-safe
create or replace function decline_contract(token uuid, p_reason text)
returns jsonb language plpgsql security definer as $$
declare
  ct record;
begin
  select * into ct
  from contracts
  where share_token = token and share_token_enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if ct.status in ('signed', 'declined', 'revoked') then
    return '{"error":"already_actioned"}'::jsonb;
  end if;

  update contracts
  set status = 'declined',
      declined_at = now(),
      declined_reason = nullif(trim(coalesce(p_reason, '')), ''),
      updated_at = now()
  where id = ct.id;

  -- Follow-up task for the MC
  insert into tasks (user_id, title, due_date, status, related_couple_id)
  values (
    ct.user_id,
    'Contract declined — follow up with couple',
    current_date,
    'todo',
    ct.couple_id
  );

  return '{"success":true}'::jsonb;
end;
$$;

-- revoke_contract — MC-only (security invoker so RLS applies)
create or replace function revoke_contract(p_contract_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  ct record;
begin
  select * into ct from contracts where id = p_contract_id;
  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if ct.status = 'signed' then
    return '{"error":"already_signed"}'::jsonb;
  end if;

  update contracts
  set status = 'draft',
      share_token = gen_random_uuid(),
      share_token_enabled = false,
      locked_content = null,
      locked_content_html = null,
      mc_signature_name = null,
      version = version + 1,
      email_sent_at = null,
      last_reminder_at = null,
      updated_at = now()
  where id = p_contract_id;

  return '{"success":true}'::jsonb;
end;
$$;

-- expire_contracts — cron target; returns ids that were flipped
create or replace function expire_contracts()
returns setof uuid language sql security definer as $$
  update contracts
  set status = 'expired', updated_at = now()
  where status = 'sent'
    and expires_at is not null
    and expires_at < current_date
  returning id;
$$;

-- reminders_due — returns contracts needing a nudge with denormalized email/business fields
create or replace function contracts_due_for_reminder()
returns table (
  id uuid,
  user_id uuid,
  couple_id uuid,
  contract_number text,
  title text,
  expires_at date,
  share_token uuid,
  email_sent_at timestamptz,
  last_reminder_at timestamptz,
  reminder_count integer,
  couple_name text,
  couple_email text,
  mc_business_name text
) language sql security definer as $$
  select c.id, c.user_id, c.couple_id, c.contract_number, c.title,
         c.expires_at, c.share_token, c.email_sent_at, c.last_reminder_at, c.reminder_count,
         cp.name as couple_name,
         cp.email as couple_email,
         coalesce(
           u.raw_user_meta_data->>'business_name',
           u.raw_user_meta_data->>'display_name',
           'Your MC'
         ) as mc_business_name
  from contracts c
  join couples cp on cp.id = c.couple_id
  join auth.users u on u.id = c.user_id
  where c.status = 'sent'
    and c.share_token_enabled = true
    and c.email_sent_at is not null
    and c.reminder_count < 2
    and cp.email is not null
    and (c.expires_at is null or c.expires_at >= current_date)
    and (
      -- 1st reminder at day 3+
      (c.reminder_count = 0 and c.email_sent_at < now() - interval '3 days')
      -- 2nd reminder at day 7+ (and at least 3 days after the 1st)
      or (c.reminder_count = 1
          and c.email_sent_at < now() - interval '7 days'
          and c.last_reminder_at < now() - interval '3 days')
    );
$$;

-- mark_contract_reminder_sent — cron-invoked; bypass RLS with SECURITY DEFINER
create or replace function mark_contract_reminder_sent(p_contract_id uuid)
returns void language sql security definer as $$
  update contracts
  set last_reminder_at = now(),
      reminder_count = reminder_count + 1,
      updated_at = now()
  where id = p_contract_id;
$$;

-- updated_at trigger for both tables
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contracts_touch_updated_at
  before update on contracts
  for each row execute function touch_updated_at();

create trigger contract_templates_touch_updated_at
  before update on contract_templates
  for each row execute function touch_updated_at();

-- Extend get_portal_data to include contracts (sent/signed/declined only — no drafts)
create or replace function get_portal_data(token uuid)
returns json language plpgsql security definer as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  v_event_id  uuid;
  result      json;
begin
  select id, user_id into v_couple_id, v_user_id
  from couples
  where portal_token = token and portal_token_enabled = true;

  if v_couple_id is null then
    return null;
  end if;

  select id into v_event_id
  from events
  where couple_id = v_couple_id
  order by
    case when date >= current_date then 0 else 1 end,
    date asc
  limit 1;

  select json_build_object(
    'couple_id',    v_couple_id,
    'couple_name',  c.name,
    'couple_email', c.email,
    'event', case when v_event_id is not null then
      json_build_object('id', e.id, 'date', e.date::text, 'venue', e.venue)
    else null end,
    'events', coalesce(
      (select json_agg(json_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue, 'status', ev.status) order by ev.date asc)
        from events ev where ev.couple_id = v_couple_id),
      '[]'::json
    ),
    'people', coalesce(
      (select json_agg(json_build_object('id', p.id, 'category', p.category, 'full_name', p.full_name,
          'phonetic', p.phonetic, 'role', p.role, 'audio_url', p.audio_url, 'position', p.position)
        order by p.category, p.position, p.created_at)
        from portal_people p where p.couple_id = v_couple_id),
      '[]'::json
    ),
    'contacts', coalesce(
      (select json_agg(json_build_object('id', ct.id, 'name', ct.name, 'category', ct.category,
          'email', ct.email, 'phone', ct.phone) order by ct.name)
        from couple_contacts cc
        join contacts ct on ct.id = cc.contact_id
        where cc.couple_id = v_couple_id),
      '[]'::json
    ),
    'songs', coalesce(
      (select json_agg(json_build_object('id', s.id, 'category', s.category, 'title', s.title,
          'artist', s.artist, 'notes', s.notes, 'position', s.position)
        order by s.category, s.position, s.created_at)
        from portal_songs s where s.couple_id = v_couple_id),
      '[]'::json
    ),
    'song_categories', coalesce(
      (select json_agg(json_build_object('key', key, 'label', label, 'description', description, 'position', position) order by position)
        from portal_song_categories where couple_id = v_couple_id),
      '[]'::json
    ),
    'files', coalesce(
      (select json_agg(json_build_object('id', f.id, 'name', f.name, 'file_url', f.file_url,
          'file_size', f.file_size, 'created_at', f.created_at) order by f.created_at)
        from portal_files f where f.couple_id = v_couple_id),
      '[]'::json
    ),
    'timeline_items', case when v_event_id is not null then coalesce(
      (select json_agg(json_build_object('id', ti.id, 'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title, 'description', ti.description,
          'duration_min', ti.duration_min, 'position', ti.position, 'pending_review', ti.pending_review)
        order by ti.start_time nulls last, ti.position)
        from timeline_items ti where ti.event_id = v_event_id),
      '[]'::json
    ) else '[]'::json end,
    'payments', json_build_object(
      'quotes', coalesce(
        (select json_agg(json_build_object('id', q.id, 'title', q.title, 'quote_number', q.quote_number,
            'status', q.status, 'subtotal', q.subtotal,
            'share_token', q.share_token, 'share_token_enabled', q.share_token_enabled)
          order by q.created_at desc)
          from quotes q where q.couple_id = v_couple_id),
        '[]'::json
      ),
      'invoices', coalesce(
        (select json_agg(json_build_object('id', inv.id, 'title', inv.title, 'invoice_number', inv.invoice_number,
            'status', inv.status, 'subtotal', inv.subtotal, 'due_date', inv.due_date::text,
            'share_token', inv.share_token, 'share_token_enabled', inv.share_token_enabled)
          order by inv.created_at desc)
          from invoices inv where inv.couple_id = v_couple_id),
        '[]'::json
      )
    ),
    'contracts', coalesce(
      (select json_agg(json_build_object(
          'id', ctr.id,
          'title', ctr.title,
          'contract_number', ctr.contract_number,
          'status', ctr.status,
          'share_token', ctr.share_token,
          'share_token_enabled', ctr.share_token_enabled,
          'email_sent_at', ctr.email_sent_at,
          'signed_at', ctr.signed_at
        ) order by ctr.created_at desc)
        from contracts ctr
        where ctr.couple_id = v_couple_id
          and ctr.status in ('sent', 'signed', 'declined', 'expired')
          and ctr.share_token_enabled = true),
      '[]'::json
    )
  )
  into result
  from couples c
  left join events e on e.id = v_event_id
  where c.id = v_couple_id;

  return result;
end;
$$;

-- Grants for public-facing and cron RPCs
grant execute on function get_public_contract(uuid) to anon;
grant execute on function sign_contract(uuid, text, text, text) to anon;
grant execute on function decline_contract(uuid, text) to anon;
grant execute on function contracts_due_for_reminder() to anon;
grant execute on function mark_contract_reminder_sent(uuid) to anon;
grant execute on function expire_contracts() to anon;
