-- Drawn signatures: let a signer draw their mark instead of typing it.
--
-- Typed-name signing is valid under the ETA 1999, but it is the least
-- convincing mark on the document, and a couple signing on a phone expects to
-- draw. The typed name STAYS required in both modes: it is what identifies the
-- signer, while the drawing is the mark. Typed remains the default, so nothing
-- about the existing flow changes for anyone who does not opt in.
--
-- ── WHY THE IMAGE IS A COLUMN, NOT A STORAGE OBJECT ──
--
-- The PDF decides it. There is no server-side PDF renderer: lib/pdf/print-
-- document.tsx serialises the React tree in the browser, writes it into a fresh
-- `window.open('')`, waits on `document.fonts.ready` plus 150ms, then calls
-- print(). It waits for FONTS, never for images. A Storage URL in that document
-- is a cold cross-origin fetch in a brand-new browsing context, so the print
-- dialog can fire before it paints — and the failure mode is a legal document
-- with a missing signature and no error anywhere. A `data:` URL is already
-- inside the string that was serialised, so there is no race to lose.
--
-- Three supporting reasons:
--   * An anonymous signer writing to Storage needs the is_valid_portal_token
--     treatment (a definer predicate over sign_token, three storage.objects
--     policies, and a service-role upload route). A text column inherits
--     contract_signers' existing RLS with no new surface at all.
--   * A Storage object survives `on delete cascade` and survives a revoke, so
--     it would need a cleanup cron. A column does not.
--   * The signature, the signer row and the audit row must land in one
--     transaction. A Storage upload cannot.
--
-- ── SIZE CAP ──
--
-- 128KB of base64 (~96KB of PNG). A monochrome stroke on a 1200x400 canvas is
-- 10-25KB, so this is generous while still bounding the row. Enforced in three
-- places because sign_contract_v2 is `security definer` and granted to anon:
-- the client re-exports at lower DPI before erroring, the API route's Zod
-- schema rejects the payload, and the CHECK below is the last word. PNG only —
-- never SVG, which is needless script surface in a document rendered into a
-- fresh window.
--
-- Additive and non-destructive: both columns are nullable (or defaulted to the
-- historical behaviour), so every existing row is unaffected.

alter table public.contract_signers
  add column if not exists signature_mode text not null default 'typed'
    check (signature_mode in ('typed', 'drawn')),
  add column if not exists signature_image text
    check (
      signature_image is null
      or (
        signature_image like 'data:image/png;base64,%'
        and length(signature_image) <= 131072
      )
    );

comment on column public.contract_signers.signature_mode is
  'typed = the signature renders as the typed name in a script face (the default and historical behaviour); drawn = signature_image holds the mark.';
comment on column public.contract_signers.signature_image is
  'The drawn signature as a base64 PNG data URL, capped at 128KB. Null when signature_mode is typed.';

-- The MC draws their signature once in Settings and it is stamped on every
-- contract they send.
--
-- On user_public_settings, NOT user_metadata: `_user_branding` reads
-- raw_user_meta_data and would leak the image onto every public surface, and
-- user_metadata is serialised into the JWT and is user-writable. A 100KB access
-- token is not acceptable, and a trust-level field must not be user-writable
-- (see the post-§7.4 auth model).
alter table public.user_public_settings
  add column if not exists mc_signature_image text
    check (
      mc_signature_image is null
      or (
        mc_signature_image like 'data:image/png;base64,%'
        and length(mc_signature_image) <= 131072
      )
    );

comment on column public.user_public_settings.mc_signature_image is
  'The MC''s drawn signature as a base64 PNG data URL. Snapshotted onto contract_signers at send time, so redrawing it never alters an already-sent contract.';

-- ── sign_contract_v2: accept and store the drawn mark ───────────────────
--
-- Rebuilt from the body created in 20260903000000. The size guard runs BEFORE
-- the audit row is emitted, so a rejected oversize payload leaves no trace of a
-- signature that did not happen.
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
    -- A legacy link whose signers have all signed already.
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

  -- Validate the drawn mark before anything is written. The CHECK constraint
  -- would also catch this, but as an exception rather than a typed error the
  -- page can explain, and only after the audit row had already been emitted.
  if v_signature_mode = 'drawn' then
    if v_signature_image is null or v_signature_image !~ '^data:image/png;base64,' then
      return jsonb_build_object('error', 'signature_invalid');
    end if;
    if length(v_signature_image) > 131072 then
      return jsonb_build_object('error', 'signature_too_large');
    end if;
  else
    -- Typed mode never carries an image, whatever the caller sent.
    v_signature_image := null;
    v_signature_mode := 'typed';
  end if;

  -- Audit row first: it survives any later revoke.
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

  -- Mirror the latest CLIENT signature onto the contract row. These columns
  -- are the denormalised fast path the PDF and status banner still read.
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
    -- Still waiting on somebody; the contract stays 'sent'.
    return jsonb_build_object(
      'ok', true, 'contract_id', v_contract.id,
      'complete', false, 'outstanding', v_outstanding
    );
  end if;

  update public.contracts
     set status = 'signed',
         signed_at = v_now
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

-- ── revoke_contract: clear the drawn mark too ───────────────────────────
--
-- Rebuilt from the live definition at 20260828010000_revoke_disables_link.sql.
-- A revoke already clears every signature so partner A's mark cannot carry over
-- onto wording that has since changed; the drawn image is part of that mark.
create or replace function public.revoke_contract(p_contract_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.contracts where id = p_contract_id;

  if v_status is null then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if v_status = 'signed' then
    return '{"error":"already_signed"}'::jsonb;
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := p_contract_id,
    p_event_type := 'revoked',
    p_actor := 'mc',
    p_revoked_from_status := v_status
  );

  update public.contracts
  set status = 'draft',
      share_token = gen_random_uuid(),
      -- Off until the next send locks a body behind it.
      share_token_enabled = false,
      locked_content = null,
      locked_content_html = null,
      mc_signature_name = null,
      email_sent_at = null,
      last_reminder_at = null,
      signed_at = null,
      signer_name = null,
      signer_ip = null,
      signer_user_agent = null,
      version = coalesce(version, 0) + 1,
      updated_at = now()
  where id = p_contract_id;

  update public.contract_signers
  set signed_at = null,
      signer_name_typed = null,
      signer_ip = null,
      signer_user_agent = null,
      signature_mode = 'typed',
      signature_image = null,
      declined_at = null,
      declined_reason = null,
      sign_token = gen_random_uuid()
  where contract_id = p_contract_id;

  return '{"success":true}'::jsonb;
end;
$$;

-- ── get_public_contract: expose the mark to the page that draws it ──────
--
-- Rebuilt from 20260903002000. Each signer gains their signature mode and
-- image, so the per-party panel can render the drawing.
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
