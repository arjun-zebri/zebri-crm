-- Certificate of completion: the audit trail and a document fingerprint on the
-- signed contract.
--
-- `contract_audit_log` has recorded every send, view, signature, decline,
-- reminder and revoke since May, and until now NOTHING has ever read it. The
-- signed PDF said "Signed by X on date" and no more, which is thin evidence if
-- a booking is ever disputed. This exposes the trail on the executed document
-- and binds it to a hash.
--
-- ── WHAT THE HASH COVERS, AND WHY NOT THE PAGE ──
--
-- Not the rendered HTML. Chrome comes from the MC's LIVE branding blocks, so a
-- hash over "the page" would change every time they edited their branding —
-- worse than no hash, because it would look like tampering. The hash covers the
-- executed facts: the agreement text plus each signer's name, mark and
-- timestamp. Those are immutable once signed.
--
-- Computed at the instant of completion, inside sign_contract_v2, in the same
-- transaction that sets status='signed'. Not on a cron and not on first render:
-- only then are the inputs final.
--
-- ── PRIVACY: WHY PUBLIC IPS ARE REDACTED ──
--
-- DocuSign's certificate lists each signer's full IP and goes to every party.
-- That is defensible there because envelope recipients are identified parties.
-- A Zebri contract link is a BEARER capability: anyone the couple forwards it
-- to becomes a link holder. So the public payload carries only a /24 (or /48)
-- prefix, which preserves the evidentiary point anyone actually uses (same
-- household vs different networks) without publishing a precise identifier to
-- whoever was forwarded the link. The full IP stays in contract_audit_log and
-- is shown to the contract's owner in-app.
--
-- The trail is also gated on a FINAL status. While a contract is in flight the
-- trail is live operational data (who opened it, when, from where) that a link
-- holder has no need for; once executed it is the evidence the parties are
-- entitled to.

alter table public.contracts
  add column if not exists document_hash text,
  add column if not exists document_hash_algo text,
  add column if not exists document_hash_at timestamptz;

comment on column public.contracts.document_hash is
  'Hex SHA-256 over the executed facts (agreement text + each signer''s name, mark and timestamp). Set once, at completion.';
comment on column public.contracts.document_hash_algo is
  'Recipe version, e.g. zebri-sha256-v1. Stored so a future recipe can coexist with rows hashed under the old one.';

create index if not exists contracts_document_hash_idx
  on public.contracts (document_hash)
  where document_hash is not null;

-- ── IP redaction ────────────────────────────────────────────────────────
-- Immutable and not granted to anon: only the definer function calls it.
create or replace function public._ip_prefix(p_ip text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_ip is null or btrim(p_ip) = '' then
    return null;
  end if;
  -- IPv4: keep the first three octets.
  if p_ip ~ '^\d{1,3}(\.\d{1,3}){3}$' then
    return regexp_replace(p_ip, '^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$', '\1.0/24');
  end if;
  -- IPv6: keep the first three hextets (/48).
  if position(':' in p_ip) > 0 then
    return (string_to_array(p_ip, ':'))[1] || ':' ||
           coalesce((string_to_array(p_ip, ':'))[2], '') || ':' ||
           coalesce((string_to_array(p_ip, ':'))[3], '') || '::/48';
  end if;
  -- Unrecognised shape: reveal nothing rather than guess.
  return null;
end;
$$;

revoke all on function public._ip_prefix(text) from public;
revoke all on function public._ip_prefix(text) from anon;

-- ── The canonical payload the hash is taken over ────────────────────────
--
-- jsonb's text output has had deterministic key ordering since 9.4, and the
-- signer array is explicitly ordered, so the same contract always produces the
-- same string. The `v` tag pins the recipe: a future v2 can change the shape
-- without invalidating rows hashed under v1.
create or replace function public._contract_canonical_payload(p_contract_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select (jsonb_build_object(
    'v', 1,
    'contract_id', c.id,
    'contract_number', c.contract_number,
    'locked_content_html', c.locked_content_html,
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'role', s.role,
               'name', s.name,
               'signing_order', s.signing_order,
               'signer_name_typed', s.signer_name_typed,
               'signed_at', s.signed_at,
               -- The image's own digest rather than the image: keeps the
               -- canonical string small while still binding the mark, and
               -- makes the result reproducible from what the certificate
               -- prints.
               'signature_sha256', case
                 when s.signature_image is null then null
                 else encode(sha256(convert_to(s.signature_image, 'UTF8')), 'hex')
               end
             ) order by s.signing_order, s.id)
        from public.contract_signers s
       where s.contract_id = c.id
    ), '[]'::jsonb)
  ))::text
  from public.contracts c
  where c.id = p_contract_id;
$$;

revoke all on function public._contract_canonical_payload(uuid) from public;
revoke all on function public._contract_canonical_payload(uuid) from anon;

-- ── Backfill already-signed contracts ───────────────────────────────────
-- Honest: every input is still present and immutable on a signed contract, so
-- the hash computed now is the same one completion would have produced. Dated
-- to signed_at rather than now(), because that is when the document was fixed.
update public.contracts
   set document_hash = encode(
         sha256(convert_to(public._contract_canonical_payload(id), 'UTF8')), 'hex'),
       document_hash_algo = 'zebri-sha256-v1',
       document_hash_at = signed_at
 where status = 'signed'
   and document_hash is null
   and signed_at is not null;

-- ── sign_contract_v2: stamp the hash at completion ──────────────────────
-- Rebuilt from 20260903004000, with the hash written in the same transaction
-- as status='signed'.
create or replace function public.sign_contract_v2(
  p_token uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract   record;
  v_signer     record;
  v_contract_id uuid;
  v_signer_id  uuid;
  v_now        timestamptz := now();
  v_outstanding int;
  v_next_id    uuid;
  v_signer_name       text := p_payload ->> 'signer_name';
  v_signer_ip         text := p_payload ->> 'signer_ip';
  v_signer_user_agent text := p_payload ->> 'signer_user_agent';
  v_signature_image   text := p_payload ->> 'signature_image';
  v_signature_mode    text := coalesce(p_payload ->> 'signature_mode', 'typed');
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;

  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  select * into v_contract
    from public.contracts
   where id = v_contract_id
     and share_token_enabled = true
     and status = 'sent'
     for update;

  if v_contract is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  if v_contract.expires_at is not null and v_contract.expires_at < current_date then
    update public.contracts set status = 'expired' where id = v_contract.id;
    return jsonb_build_object('error', 'expired');
  end if;

  if v_signer_id is null then
    return jsonb_build_object('error', 'already_signed');
  end if;

  select * into v_signer
    from public.contract_signers
   where id = v_signer_id
     for update;

  if v_signer.signed_at is not null then
    return jsonb_build_object('error', 'already_signed');
  end if;
  if v_signer.declined_at is not null then
    return jsonb_build_object('error', 'already_declined');
  end if;

  if v_contract.signing_mode = 'sequential' and v_signer.role = 'client' then
    if exists (
      select 1 from public.contract_signers s
       where s.contract_id = v_contract.id
         and s.role = 'client'
         and s.required
         and s.signed_at is null
         and s.declined_at is null
         and s.signing_order < v_signer.signing_order
    ) then
      return jsonb_build_object('error', 'not_your_turn');
    end if;
  end if;

  if v_contract.require_signer_otp and v_signer.role = 'client' then
    if v_signer.otp_verified_at is null
       or v_signer.otp_verified_at < now() - interval '30 minutes' then
      return jsonb_build_object('error', 'otp_required');
    end if;
  end if;

  if v_signature_mode = 'drawn' then
    if v_signature_image is null or v_signature_image !~ '^data:image/png;base64,' then
      return jsonb_build_object('error', 'signature_invalid');
    end if;
    if length(v_signature_image) > 131072 then
      return jsonb_build_object('error', 'signature_too_large');
    end if;
  else
    v_signature_image := null;
    v_signature_mode := 'typed';
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'signed',
    p_actor := case when v_signer.role = 'vendor' then 'mc' else 'couple' end,
    p_actor_ip := v_signer_ip,
    p_actor_user_agent := v_signer_user_agent,
    p_signer_name_typed := v_signer_name
  );

  update public.contract_signers
     set signed_at = v_now,
         signer_name_typed = v_signer_name,
         signer_ip = v_signer_ip,
         signer_user_agent = v_signer_user_agent,
         signature_mode = v_signature_mode,
         signature_image = v_signature_image
   where id = v_signer_id;

  if v_signer.role = 'client' then
    update public.contracts
       set signer_name = v_signer_name,
           signer_ip = v_signer_ip,
           signer_user_agent = v_signer_user_agent
     where id = v_contract.id;
  end if;

  select count(*) into v_outstanding
    from public.contract_signers
   where contract_id = v_contract.id
     and required
     and signed_at is null;

  if v_outstanding > 0 then
    if v_contract.signing_mode = 'sequential' then
      select s.id into v_next_id
        from public.contract_signers s
       where s.contract_id = v_contract.id
         and s.role = 'client'
         and s.required
         and s.signed_at is null
         and s.declined_at is null
       order by s.signing_order
       limit 1;
    end if;

    return jsonb_build_object(
      'ok', true, 'contract_id', v_contract.id,
      'complete', false, 'outstanding', v_outstanding,
      'next_signer_id', v_next_id
    );
  end if;

  -- Complete. The hash is taken here, after the final signature row is written
  -- and inside the same transaction, so it covers exactly what was executed.
  update public.contracts
     set status = 'signed',
         signed_at = v_now,
         document_hash = encode(
           sha256(convert_to(public._contract_canonical_payload(v_contract.id), 'UTF8')), 'hex'),
         document_hash_algo = 'zebri-sha256-v1',
         document_hash_at = v_now
   where id = v_contract.id;

  update public.couples
     set status = 'confirmed'
   where id = v_contract.couple_id and status in ('lead', 'enquiry', 'quoted');

  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract signed - follow up with couple',
    'todo'
  );

  return jsonb_build_object(
    'ok', true, 'contract_id', v_contract.id, 'complete', true, 'outstanding', 0
  );
end;
$$;

grant execute on function public.sign_contract_v2(uuid, jsonb) to anon;

-- ── get_public_contract: the audit trail + fingerprint ──────────────────
-- Rebuilt from 20260903004000. `audit_trail` appears ONLY on a final status,
-- and IPs in it are prefixed. Email addresses are deliberately not included.
create or replace function get_public_contract(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract uuid;
  v_signer   uuid;
  result     jsonb;
begin
  select r.contract_id, r.signer_id into v_contract, v_signer
    from public._resolve_contract_token(token) r;

  if v_contract is null then
    return null;
  end if;

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
    'event_date', cp.event_date,
    'venue', cp.venue,
    'branding_blocks', _user_branding_blocks(c.user_id, 'contract'),
    'viewer_signer_id', v_signer,
    'signing_mode', c.signing_mode,
    'require_signer_otp', c.require_signer_otp,
    'document_hash', c.document_hash,
    'document_hash_algo', c.document_hash_algo,
    'document_hash_at', c.document_hash_at,
    'viewer_otp_verified', (
      select s.otp_verified_at is not null
         and s.otp_verified_at >= now() - interval '30 minutes'
        from public.contract_signers s
       where s.id = v_signer
    ),
    'audit_trail', case
      when c.status in ('signed', 'declined') then coalesce((
        select jsonb_agg(jsonb_build_object(
                 'event_type', a.event_type,
                 'actor', a.actor,
                 'event_at', a.event_at,
                 'signer_name_typed', a.signer_name_typed,
                 'decline_reason', a.decline_reason,
                 'reminder_number', a.reminder_number,
                 -- Prefix only. See this migration's header for why.
                 'actor_ip_prefix', public._ip_prefix(a.actor_ip),
                 'actor_user_agent', a.actor_user_agent
               ) order by a.event_at, a.id)
          from public.contract_audit_log a
         where a.contract_id = c.id
      ), '[]'::jsonb)
      else null
    end,
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'role', s.role,
               'name', s.name,
               'signer_name_typed', s.signer_name_typed,
               'signature_mode', s.signature_mode,
               'signature_image', s.signature_image,
               'signing_order', s.signing_order,
               'required', s.required,
               'signed_at', s.signed_at,
               'declined_at', s.declined_at
             ) order by s.signing_order, s.created_at)
        from public.contract_signers s
       where s.contract_id = c.id
    ), '[]'::jsonb)
  ) || coalesce(_user_branding(c.user_id), '{}'::jsonb)
  into result
  from contracts c
  join couples cp on cp.id = c.couple_id
  where c.id = v_contract
    and c.share_token_enabled = true
    and c.status <> 'draft'
    and c.status <> 'revoked';

  return result;
end;
$$;

grant execute on function get_public_contract(uuid) to anon;

-- ── Public fingerprint lookup ───────────────────────────────────────────
--
-- What turns the printed hash from decoration into something usable: a venue or
-- tribunal holding only the PDF can confirm it corresponds to a record Zebri
-- holds. Looks up by hash ONLY, never by token, and returns no document
-- content. Disclosing the signer names is acceptable because the hash is only
-- obtainable from the PDF, which the holder already has.
create or replace function public.verify_contract_hash(p_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('found', false);
  end if;

  select jsonb_build_object(
    'found', true,
    'contract_number', c.contract_number,
    'signed_at', c.signed_at,
    'algo', c.document_hash_algo,
    'signer_names', coalesce((
      select jsonb_agg(s.name order by s.signing_order)
        from public.contract_signers s
       where s.contract_id = c.id and s.signed_at is not null
    ), '[]'::jsonb)
  )
  into result
  from public.contracts c
  where c.document_hash = p_hash and c.status = 'signed';

  return coalesce(result, jsonb_build_object('found', false));
end;
$$;

grant execute on function public.verify_contract_hash(text) to anon;

comment on function public.verify_contract_hash(text) is
  'Public fingerprint lookup: confirms a document hash corresponds to a signed contract Zebri holds. Returns no document content.';
