-- ============================================================
-- INCIDENT RECOVERY: production schema drift
-- ============================================================
--
-- On 2026-05-20, the prod migration ledger was back-filled
-- (roadmap §7.9) to bring it in line with the repo. But for three
-- migrations the LEDGER row was inserted while the underlying SQL
-- was never executed:
--
--   - 20260421000000_add_contracts_feature        → contracts +
--                                                   contract_templates
--                                                   tables + 8 RPCs
--                                                   never created.
--   - 20260421000001_seed_default_contract_template
--                                                → seed function +
--                                                   template never
--                                                   created.
--   - 20260513213717_create_user_branding         → user_branding
--                                                   table never
--                                                   created.
--
-- Symptom that surfaced the issue: John (john@edneycelebrations.com.au)
-- — a paid Pro user — got Starter treatment because the
-- separate 20260521000000 back-fill migration was also pending,
-- AND because some app paths fall back to defaults when
-- contract/branding state can't be read.
--
-- We CANNOT simply delete the bogus ledger entries and re-push
-- the original migrations: `20260421000000_add_contracts_feature`
-- includes a `create or replace function get_portal_data(...)`
-- that would REVERT the function to its 6-week-old version, losing
-- the branding work added by migrations 20260513…, 20260514…,
-- 20260516… (which DID actually run, per the
-- `pg_get_functiondef('get_portal_data') like '%branding%'` check).
--
-- This recovery migration recreates ONLY the missing schema —
-- tables, indexes, RLS policies, contract-specific RPCs, the
-- contract template seed, and the user_branding table. It does
-- NOT touch get_portal_data, _user_branding, or any RPC that's
-- already correctly defined in prod.
--
-- After this lands, the two genuinely-pending migrations apply
-- cleanly:
--   - 20260527000000_share_token_enabled_by_default (needs
--     contracts table to exist)
--   - 20260528000000_create_contract_audit_log (depends on
--     contracts + redefines sign_contract / decline_contract /
--     revoke_contract / expire_contracts / mark_contract_reminder_sent
--     to call emit_contract_audit_event — supersedes the versions
--     we create here).
--
-- ============================================================

-- ── 1. contracts + contract_templates tables ──────────────────

create table if not exists contracts (
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

create table if not exists contract_templates (
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

alter table contracts enable row level security;
alter table contract_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contracts'
      and policyname = 'Users manage own contracts'
  ) then
    create policy "Users manage own contracts" on contracts
      for all using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contract_templates'
      and policyname = 'Users manage own contract_templates'
  ) then
    create policy "Users manage own contract_templates" on contract_templates
      for all using (user_id = auth.uid());
  end if;
end $$;

create index if not exists contracts_share_token_idx       on contracts(share_token);
create index if not exists contracts_couple_id_idx         on contracts(couple_id);
create index if not exists contracts_user_id_idx           on contracts(user_id);
create index if not exists contracts_quote_id_idx          on contracts(quote_id);
create index if not exists contracts_status_expires_idx    on contracts(status, expires_at);
create index if not exists contract_templates_user_id_idx  on contract_templates(user_id);

-- ── 2. Contract RPCs (EXCLUDING get_portal_data — see banner) ──

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

-- get_public_contract at the May-14 definition (calls
-- _user_branding_blocks + composes _user_branding). The
-- add_branding_blocks_to_public_rpcs migration is also drifted
-- in prod, so this is the canonical version we land.
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
    'branding_blocks', _user_branding_blocks(c.user_id, 'contract')
  ) || coalesce(_user_branding(c.user_id), '{}'::jsonb)
  into result
  from contracts c
  join couples cp on cp.id = c.couple_id
  where c.share_token = token
    and c.share_token_enabled = true
    and c.status <> 'revoked';
  return result;
end;
$$;

grant execute on function get_public_contract(uuid) to anon;

create or replace function sign_contract(
  token uuid,
  p_signer_name text,
  p_signer_ip text,
  p_signer_user_agent text
)
returns jsonb language plpgsql security definer as $$
declare
  ct record; couple record; q record;
  new_invoice_id uuid; deposit_pct numeric; invoice_num text; item record;
begin
  select * into ct from contracts where share_token = token and share_token_enabled = true;
  if not found then return '{"error":"not_found"}'::jsonb; end if;
  if ct.status in ('signed', 'declined', 'revoked') then return '{"error":"already_actioned"}'::jsonb; end if;
  if ct.expires_at is not null and ct.expires_at < current_date then return '{"error":"expired"}'::jsonb; end if;
  if p_signer_name is null or length(trim(p_signer_name)) = 0 then return '{"error":"missing_signer_name"}'::jsonb; end if;

  update contracts
  set status = 'signed', signed_at = now(),
      signer_name = trim(p_signer_name), signer_ip = p_signer_ip,
      signer_user_agent = p_signer_user_agent, updated_at = now()
  where id = ct.id;

  select * into couple from couples where id = ct.couple_id;

  update couples set status = 'confirmed'
  where id = ct.couple_id and status not in ('confirmed', 'paid', 'complete');

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
        ct.user_id, ct.couple_id, ct.quote_id, invoice_num,
        'Deposit for ' || couple.name, 'draft',
        q.subtotal, coalesce(q.tax_rate, 0), q.discount_type, q.discount_value, q.notes,
        deposit_pct, current_date + interval '7 days', false
      ) returning id into new_invoice_id;
      for item in select * from quote_items where quote_id = ct.quote_id order by position loop
        insert into invoice_items (invoice_id, user_id, description, quantity, unit_price, amount, position)
        values (new_invoice_id, ct.user_id, item.description, 1, item.amount, item.amount, item.position);
      end loop;
    end if;
  end if;

  insert into tasks (user_id, title, due_date, status, related_couple_id)
  values (ct.user_id,
          'Contract signed by ' || couple.name || ' — review & send deposit invoice',
          current_date, 'todo', ct.couple_id);

  return jsonb_build_object('success', true, 'invoice_id', new_invoice_id);
end;
$$;

create or replace function decline_contract(token uuid, p_reason text)
returns jsonb language plpgsql security definer as $$
declare ct record;
begin
  select * into ct from contracts where share_token = token and share_token_enabled = true;
  if not found then return '{"error":"not_found"}'::jsonb; end if;
  if ct.status in ('signed', 'declined', 'revoked') then return '{"error":"already_actioned"}'::jsonb; end if;
  update contracts
  set status = 'declined', declined_at = now(),
      declined_reason = nullif(trim(coalesce(p_reason, '')), ''),
      updated_at = now()
  where id = ct.id;
  insert into tasks (user_id, title, due_date, status, related_couple_id)
  values (ct.user_id, 'Contract declined — follow up with couple',
          current_date, 'todo', ct.couple_id);
  return '{"success":true}'::jsonb;
end;
$$;

create or replace function revoke_contract(p_contract_id uuid)
returns jsonb language plpgsql security invoker as $$
declare ct record;
begin
  select * into ct from contracts where id = p_contract_id;
  if not found then return '{"error":"not_found"}'::jsonb; end if;
  if ct.status = 'signed' then return '{"error":"already_signed"}'::jsonb; end if;
  update contracts
  set status = 'draft', share_token = gen_random_uuid(), share_token_enabled = false,
      locked_content = null, locked_content_html = null, mc_signature_name = null,
      version = version + 1, email_sent_at = null, last_reminder_at = null, updated_at = now()
  where id = p_contract_id;
  return '{"success":true}'::jsonb;
end;
$$;

create or replace function expire_contracts()
returns setof uuid language sql security definer as $$
  update contracts set status = 'expired', updated_at = now()
  where status = 'sent' and expires_at is not null and expires_at < current_date
  returning id;
$$;

create or replace function contracts_due_for_reminder()
returns table (
  id uuid, user_id uuid, couple_id uuid, contract_number text, title text,
  expires_at date, share_token uuid, email_sent_at timestamptz,
  last_reminder_at timestamptz, reminder_count integer,
  couple_name text, couple_email text, mc_business_name text
) language sql security definer as $$
  select c.id, c.user_id, c.couple_id, c.contract_number, c.title,
         c.expires_at, c.share_token, c.email_sent_at, c.last_reminder_at, c.reminder_count,
         cp.name, cp.email,
         coalesce(u.raw_user_meta_data->>'business_name',
                  u.raw_user_meta_data->>'display_name',
                  'Your MC')
  from contracts c
  join couples cp on cp.id = c.couple_id
  join auth.users u on u.id = c.user_id
  where c.status = 'sent' and c.share_token_enabled = true
    and c.email_sent_at is not null and c.reminder_count < 2
    and cp.email is not null
    and (c.expires_at is null or c.expires_at >= current_date)
    and (
      (c.reminder_count = 0 and c.email_sent_at < now() - interval '3 days')
      or (c.reminder_count = 1
          and c.email_sent_at < now() - interval '7 days'
          and c.last_reminder_at < now() - interval '3 days')
    );
$$;

create or replace function mark_contract_reminder_sent(p_contract_id uuid)
returns void language sql security definer as $$
  update contracts
  set last_reminder_at = now(),
      reminder_count = reminder_count + 1,
      updated_at = now()
  where id = p_contract_id;
$$;

-- touch_updated_at probably exists already (used by quotes / invoices).
-- Safe to recreate.
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'contracts_touch_updated_at') then
    create trigger contracts_touch_updated_at before update on contracts
      for each row execute function touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'contract_templates_touch_updated_at') then
    create trigger contract_templates_touch_updated_at before update on contract_templates
      for each row execute function touch_updated_at();
  end if;
end $$;

-- IMPORTANT: get_portal_data is INTENTIONALLY NOT redefined here.
-- The version currently in prod (from 20260516010000_portal_header_banner_block)
-- references contracts in its SELECT — that's fine because the
-- contracts table now exists.

-- ── 3. Default contract template seed ─────────────────────────
-- Copied verbatim from 20260421000001_seed_default_contract_template.sql.
-- Long, intentional — full Australian Wedding MC Service Agreement.

-- Full 24-clause Wedding MC Service Agreement, copied verbatim
-- from 20260421000001_seed_default_contract_template.sql. Kept
-- intact so new users get a legal-grade default.
create or replace function seed_default_contract_template(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from contract_templates where user_id = p_user_id) then
    insert into contract_templates (user_id, name, description, content, is_default, position)
    values (
      p_user_id,
      'Wedding MC Service Agreement',
      'Professional service agreement drafted for Australian wedding MCs',
      $template${
        "type": "doc",
        "content": [
          { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Wedding MC Service Agreement" }] },

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Parties" }] },
          { "type": "paragraph", "content": [
            { "type": "text", "text": "This agreement is made on " },
            { "type": "mention", "attrs": { "id": "today" } },
            { "type": "text", "text": " between " },
            { "type": "mention", "attrs": { "id": "mc_business_name" } },
            { "type": "text", "marks": [{ "type": "italic" }], "text": " (the MC) " },
            { "type": "text", "text": "and " },
            { "type": "mention", "attrs": { "id": "couple_name" } },
            { "type": "text", "marks": [{ "type": "italic" }], "text": " (the Couple)" },
            { "type": "text", "text": ". Each a " },
            { "type": "text", "marks": [{ "type": "italic" }], "text": "Party" },
            { "type": "text", "text": " and together, the " },
            { "type": "text", "marks": [{ "type": "italic" }], "text": "Parties" },
            { "type": "text", "text": "." }
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "1. Definitions and interpretation" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "In this agreement:" }] },
          { "type": "bulletList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Event " },
              { "type": "text", "text": "means the wedding reception described in clause 2." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Services " },
              { "type": "text", "text": "means the wedding MC services described in clause 3." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Fee " },
              { "type": "text", "text": "means the total amount payable under clause 4." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Business Day " },
              { "type": "text", "text": "means a day other than a Saturday, Sunday or public holiday in the state in which the MC is registered." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "GST " },
              { "type": "text", "text": "has the meaning given in the A New Tax System (Goods and Services Tax) Act 1999 (Cth)." }
            ]}]}
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "Headings are for convenience only and do not affect interpretation. References to dollar amounts are in Australian Dollars. Words importing the singular include the plural and vice versa." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "2. Event details" }] },
          { "type": "paragraph", "content": [
            { "type": "text", "text": "Event date: " },
            { "type": "mention", "attrs": { "id": "event_date" } }
          ]},
          { "type": "paragraph", "content": [
            { "type": "text", "text": "Venue: " },
            { "type": "mention", "attrs": { "id": "venue" } }
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "Final call times, set-up time and run sheet will be confirmed in writing by the MC no later than 14 days before the Event." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "3. Services" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC agrees to provide the following Services at the Event:" }]},
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Reception hosting, emceeing and formal announcements, including introduction of the bridal party, speeches, cake cutting, first dance and any other items agreed in the run sheet." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Pre-event planning consultation(s) and preparation of a detailed run sheet in consultation with the Couple." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "On-the-night coordination with the venue, photographer, DJ or band and other suppliers, as needed to deliver a smooth flow of formalities." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Guest engagement, crowd energy management and smooth handling of unexpected changes on the night." }]}]}
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Services commence at the agreed call time and conclude at the end of the formalities as specified in the run sheet, or as otherwise agreed in writing." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "4. Fees, deposit and payment" }] },
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "text": "The Fee for the Services is " },
              { "type": "mention", "attrs": { "id": "total_amount" } },
              { "type": "text", "text": ". All amounts are inclusive of GST unless otherwise stated on the accompanying quote." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "text": "A non-refundable deposit of " },
              { "type": "mention", "attrs": { "id": "deposit_amount" } },
              { "type": "text", "text": " is payable within 7 days of signing this agreement. The Couple's booking is not secured until the deposit is received by the MC in cleared funds." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "The balance of the Fee is payable no later than 14 days before the Event. Payment is to be made via bank transfer to the account details provided on the MC's invoice." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "If the balance is not paid by the due date, the MC may, at its discretion, suspend or terminate the Services and the Couple will remain liable for the full Fee. Amounts overdue by more than 14 days accrue interest at 2% per month (or part thereof) on the outstanding balance." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Any additional services requested outside the scope of this agreement (including overtime beyond the agreed end time, ceremony hosting or travel outside the metropolitan area of the venue) will be charged at the MC's standard rates and agreed in writing before being performed." }]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "5. Cancellation by the Couple" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The deposit is non-refundable under all circumstances. If the Couple cancels the Event:" }]},
          { "type": "bulletList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "60 or more days before the Event — no further amount is owed beyond the deposit." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "31 to 59 days before the Event — 50% of the remaining balance becomes immediately payable." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "30 days or less before the Event — the full remaining balance becomes immediately payable." }]}]}
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "Cancellation must be notified in writing to the MC. Cancellation amounts reflect the MC's reasonable estimate of loss arising from the late cancellation, including loss of opportunity to book alternative work." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "6. Cancellation or non-performance by the MC" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "If the MC is unable to perform the Services due to circumstances within the MC's reasonable control, the MC will:" }]},
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Notify the Couple in writing as soon as reasonably practicable; and" }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Use reasonable endeavours to arrange a suitably qualified substitute MC acceptable to the Couple, or refund all amounts paid to the MC under this agreement, including the deposit." }]}]}
          ]},
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Couple acknowledges that the MC's maximum liability in these circumstances is limited as set out in clause 14." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "7. Rescheduling" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "Rescheduling of the Event is subject to the MC's availability on the new proposed date. If the MC is available, the Fee and deposit carry forward to the new date. A rescheduling administration fee of $100 applies where the request is made within 30 days of the original Event date. If the MC is not available on the new date, the provisions of clause 5 apply as though the Event had been cancelled." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "8. Force majeure" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "Neither Party is liable for failure or delay in performing its obligations where that failure is caused by circumstances beyond its reasonable control, including (without limitation) natural disaster, serious illness or injury, pandemic, government-mandated restrictions, venue closure or public transport failure. In such circumstances the Parties agree to work in good faith to reschedule the Event. If rescheduling is not possible, amounts paid beyond the deposit will be refunded, and the deposit will be retained by the MC to cover work already performed up to the date of the force majeure event." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "9. MC obligations and conduct" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC will:" }]},
          { "type": "bulletList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Perform the Services with due care, skill and in a professional manner." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Arrive at the venue at the agreed call time, appropriately attired, and remain on-site for the duration of the agreed formalities." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Refrain from consuming alcohol or non-prescription substances that would impair performance while on duty." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Comply with all reasonable directions of the venue relating to safety and conduct on site." }]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "10. Couple obligations" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Couple will:" }]},
          { "type": "bulletList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Provide the MC with accurate and timely information required to prepare the run sheet, including names, phonetic pronunciations, song titles and any sensitivities to be avoided." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Ensure the venue provides safe access, adequate sound equipment, a suitable microphone input channel and mains power, or arrange alternative equipment through the MC at additional cost." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Provide a hot meal and access to non-alcoholic refreshments for the MC where the Services exceed 4 hours on-site." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Pay the Fee and any approved additional charges by the due dates specified in clause 4." }]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "11. Equipment and technical requirements" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC will supply a personal handheld microphone, in-ear monitor and basic audio feed cabling as reasonably required to deliver the Services. The Couple and venue are responsible for providing a compatible PA system, microphone input channel(s), mixing desk and adequate mains power. The MC is not liable for technical failures attributable to venue-supplied equipment, third-party audio systems or external contractors." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "12. Substitute MC" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "Where the MC is genuinely unable to attend due to illness, injury or other unavoidable circumstances, the MC may engage a suitably experienced substitute MC to perform the Services. The MC will notify the Couple of the substitute as soon as reasonably practicable. The MC remains responsible for the Fee arrangement and for ensuring the substitute is properly briefed with the Couple's run sheet and information." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "13. Insurance" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC confirms that it holds current public liability insurance appropriate to the delivery of the Services. A certificate of currency is available on request. The Couple acknowledges that the MC does not insure the Couple or guests against personal loss, injury or damage occurring at the venue." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "14. Limitation of liability" }] },
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Subject to clause 15 (Consumer guarantees), the MC's total aggregate liability to the Couple under or in connection with this agreement is limited to the total Fee actually paid by the Couple to the MC." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "To the maximum extent permitted by law, the MC is not liable for any indirect, consequential, special or incidental loss or damage, including loss of profit, loss of enjoyment or loss of opportunity." }]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "The Couple indemnifies the MC against any claim, loss or damage arising from inaccurate or misleading information supplied by the Couple and used in good faith by the MC in performance of the Services." }]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "15. Consumer guarantees" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "Nothing in this agreement excludes, restricts or modifies any right, guarantee, warranty or remedy conferred on the Couple by the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) or any other law where to do so would be unlawful. Where the MC is entitled to limit liability for breach of a consumer guarantee, its liability is limited (at the MC's option) to re-supplying the Services or refunding the Fee paid for the Services." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "16. Creative control" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC retains creative control over delivery, phrasing, tone, humour and timing while working from the agreed run sheet. The Couple acknowledges that the MC may use reasonable judgement on the night to adapt to unexpected changes. Content that is offensive, discriminatory, defamatory or otherwise inappropriate may be declined at the MC's reasonable discretion, notwithstanding any prior request by the Couple." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "17. Intellectual property" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "All scripts, run sheets, written material and creative work produced by the MC in connection with the Services remain the intellectual property of the MC. The Couple is granted a non-exclusive, non-transferable licence to use such materials solely for the purposes of the Event. Materials supplied by the Couple (including photographs and personal information) remain the property of the Couple." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "18. Privacy and confidentiality" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The MC will handle personal information supplied by the Couple in accordance with the Privacy Act 1988 (Cth) and solely for the purposes of delivering the Services. The MC will not disclose personal information to third parties without the Couple's prior written consent, except where required by law or where disclosure is necessary to deliver the Services (for example, to the venue or other suppliers)." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "19. Photography and promotional use" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Couple consents to the MC referring to the Event in non-identifiable form in marketing materials, portfolio listings and testimonials (for example, referring to the season and venue in general terms). The MC will not publish identifiable photographs or footage of the Couple or guests without the Couple's prior written consent. The Couple may withdraw consent by written notice to the MC at any time." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "20. Notices" }] },
          { "type": "paragraph", "content": [
            { "type": "text", "text": "Any notice under this agreement must be in writing and sent to the Couple at " },
            { "type": "mention", "attrs": { "id": "couple_email" } },
            { "type": "text", "text": " or to the MC at the email address shown on the MC's invoice. A notice sent by email is taken to be received on the next Business Day after sending, unless the sender receives a delivery failure notification." }
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "21. Dispute resolution" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "The Parties must first attempt to resolve any dispute arising out of or in connection with this agreement through good-faith discussion. If the dispute is not resolved within 14 days, either Party may refer the dispute to mediation through a mediator agreed between the Parties, or, failing agreement, a mediator nominated by the Resolution Institute. Each Party bears its own costs of mediation and shares the mediator's fees equally. Nothing in this clause prevents a Party from seeking urgent interlocutory relief." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "22. Governing law and jurisdiction" }] },
          { "type": "paragraph", "content": [{ "type": "text", "text": "This agreement is governed by the laws of the State of Victoria, Australia. Each Party irrevocably submits to the exclusive jurisdiction of the courts of that State and courts of appeal from them." }]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "23. General" }] },
          { "type": "orderedList", "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Entire agreement. " },
              { "type": "text", "text": "This agreement constitutes the entire agreement between the Parties and supersedes all prior discussions, negotiations and representations. Any variation must be agreed in writing signed by both Parties." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Assignment. " },
              { "type": "text", "text": "The Couple may not assign its rights under this agreement without the MC's prior written consent. Subject to clause 12, the MC may not subcontract its obligations without the Couple's consent, not to be unreasonably withheld." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Severability. " },
              { "type": "text", "text": "If any provision of this agreement is held to be invalid or unenforceable, the remainder of the agreement continues in full force and effect." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Waiver. " },
              { "type": "text", "text": "No failure or delay by a Party in exercising any right under this agreement operates as a waiver of that right. A waiver is only effective if given in writing." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Counterparts and electronic signatures. " },
              { "type": "text", "text": "This agreement may be executed in counterparts and by typed-name electronic signature. The Parties acknowledge that a typed name, in combination with positive assent (such as ticking an acceptance box), constitutes a valid electronic signature under the Electronic Transactions Act 1999 (Cth) and applicable state legislation." }
            ]}]},
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [
              { "type": "text", "marks": [{ "type": "bold" }], "text": "Relationship. " },
              { "type": "text", "text": "The MC is engaged as an independent contractor. Nothing in this agreement creates an employment, partnership, joint venture or agency relationship between the Parties." }
            ]}]}
          ]},

          { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "24. Acknowledgement and acceptance" }] },
          { "type": "paragraph", "content": [
            { "type": "text", "text": "By signing below, " },
            { "type": "mention", "attrs": { "id": "couple_name" } },
            { "type": "text", "text": " confirms that they have read this agreement in full, have had the opportunity to seek independent legal advice, and agree to be legally bound by its terms." }
          ]}
        ]
      }$template$::jsonb,
      true, 0
    );
  end if;
end;
$$;

create or replace function trigger_seed_contract_template()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform seed_default_contract_template(new.id); return new; end;
$$;

drop trigger if exists on_new_user_seed_contract_template on auth.users;
create trigger on_new_user_seed_contract_template
  after insert on auth.users for each row execute function trigger_seed_contract_template();

-- Back-fill: seed for every existing user who has no templates.
do $$
declare r record;
begin
  for r in select id from auth.users loop
    perform seed_default_contract_template(r.id);
  end loop;
end;
$$;

-- ── 4. user_branding table ────────────────────────────────────
-- Section ordering note: user_branding has to be created BEFORE the
-- May-14 RPCs below reference it via _user_branding_blocks. We
-- moved the table create here (was section 4 of the original
-- recovery draft); the May-14 RPCs follow as section 5.


create table if not exists public.user_branding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  branding_blocks jsonb,
  brand_kits jsonb not null default '[]'::jsonb,
  portal_sections jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_branding_updated_at
  on public.user_branding(updated_at desc);

alter table public.user_branding enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_branding'
      and policyname = 'user_branding_select'
  ) then
    create policy user_branding_select on public.user_branding
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_branding'
      and policyname = 'user_branding_insert'
  ) then
    create policy user_branding_insert on public.user_branding
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_branding'
      and policyname = 'user_branding_update'
  ) then
    create policy user_branding_update on public.user_branding
      for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_branding'
      and policyname = 'user_branding_delete'
  ) then
    create policy user_branding_delete on public.user_branding
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Back-fill: copy any existing branding state from user_metadata
-- into user_branding so MCs don't lose work. Idempotent via the
-- on-conflict update.
do $$
declare u record;
begin
  for u in
    select id, raw_user_meta_data
    from auth.users
    where raw_user_meta_data ? 'branding_blocks'
       or raw_user_meta_data ? 'brand_kits'
       or raw_user_meta_data ? 'portal_sections'
  loop
    insert into public.user_branding (user_id, branding_blocks, brand_kits, portal_sections)
    values (
      u.id,
      u.raw_user_meta_data -> 'branding_blocks',
      coalesce(u.raw_user_meta_data -> 'brand_kits', '[]'::jsonb),
      u.raw_user_meta_data -> 'portal_sections'
    )
    on conflict (user_id) do update
      set branding_blocks = excluded.branding_blocks,
          brand_kits      = excluded.brand_kits,
          portal_sections = excluded.portal_sections;
  end loop;
end $$;

-- ── 5. May-14 branding-blocks RPCs (also drifted) ─────────────
-- The add_branding_blocks_to_public_rpcs migration is in the
-- prod ledger but the SQL never ran — `_user_branding_blocks`
-- is missing from prod's pg_proc. We recreate it + re-define
-- the three public document RPCs to include `branding_blocks`
-- in their output. `CREATE OR REPLACE` is a no-op if the prod
-- version somehow matches; otherwise it brings it into line.

create or replace function _user_branding_blocks(p_user_id uuid, p_surface text)
returns jsonb
language sql
security definer
stable
as $$
  select branding_blocks -> p_surface
  from public.user_branding
  where user_id = p_user_id;
$$;

revoke all on function _user_branding_blocks(uuid, text) from public, anon, authenticated;

-- get_public_quote at the May-14 definition (with branding_blocks)
create or replace function get_public_quote(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'quote_number', q.quote_number,
    'status', q.status,
    'subtotal', q.subtotal,
    'tax_rate', q.tax_rate,
    'discount_type', q.discount_type,
    'discount_value', q.discount_value,
    'notes', q.notes,
    'expires_at', q.expires_at,
    'accepted_at', q.accepted_at,
    'couple_name', c.name,
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', qi.id,
            'description', qi.description,
            'amount', qi.amount,
            'position', qi.position
          ) order by qi.position
        ),
        '[]'::jsonb
      )
      from quote_items qi
      where qi.quote_id = q.id
    ),
    'branding_blocks', _user_branding_blocks(q.user_id, 'quote')
  ) || coalesce(_user_branding(q.user_id), '{}'::jsonb)
  into result
  from quotes q
  join couples c on c.id = q.couple_id
  where q.share_token = token
    and q.share_token_enabled = true;

  return result;
end;
$$;

-- get_public_invoice at the May-14 definition (with branding_blocks)
create or replace function get_public_invoice(token uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', i.id,
    'invoice_number', i.invoice_number,
    'title', i.title,
    'status', i.status,
    'subtotal', i.subtotal,
    'tax_rate', i.tax_rate,
    'discount_type', i.discount_type,
    'discount_value', i.discount_value,
    'due_date', i.due_date,
    'payment_terms', i.payment_terms,
    'notes', i.notes,
    'paid_at', i.paid_at,
    'share_token', i.share_token,
    'deposit_percent', i.deposit_percent,
    'deposit_due_date', i.deposit_due_date,
    'deposit_paid_at', i.deposit_paid_at,
    'final_due_date', i.final_due_date,
    'final_paid_at', i.final_paid_at,
    'stripe_payment_enabled', i.stripe_payment_enabled,
    'couple_name', c.name,
    'bank_account_name', (
      select raw_user_meta_data->>'bank_account_name'
      from auth.users where id = i.user_id
    ),
    'bank_bsb', (
      select raw_user_meta_data->>'bank_bsb'
      from auth.users where id = i.user_id
    ),
    'bank_account_number', (
      select raw_user_meta_data->>'bank_account_number'
      from auth.users where id = i.user_id
    ),
    'stripe_connect_enabled', (
      select (raw_user_meta_data->>'stripe_connect_enabled')::boolean
      from auth.users where id = i.user_id
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', ii.id,
            'description', ii.description,
            'quantity', ii.quantity,
            'unit_price', ii.unit_price,
            'amount', ii.amount,
            'position', ii.position
          ) order by ii.position
        ),
        '[]'::jsonb
      )
      from invoice_items ii
      where ii.invoice_id = i.id
    ),
    'branding_blocks', _user_branding_blocks(i.user_id, 'invoice')
  ) || coalesce(_user_branding(i.user_id), '{}'::jsonb)
  into result
  from invoices i
  join couples c on c.id = i.couple_id
  where i.share_token = token
    and i.share_token_enabled = true;

  return result;
end;
$$;

grant execute on function get_public_quote(uuid) to anon;
grant execute on function get_public_invoice(uuid) to anon;
