-- The portal-audio and portal-files buckets only had public SELECT policies,
-- so uploads relied entirely on the service_role key bypassing RLS. Under the
-- new publishable/secret key model that bypass cannot be relied on, and the
-- MC dashboard's pronunciation recorder + file uploader run client-side with
-- the publishable key (path = "<couple_id>/..."). The public portal uploader
-- runs through /api/portal/upload (path = "<portal_token>/...").
--
-- These policies grant insert/update/delete on storage.objects when EITHER:
--   - the path's first folder is a couple_id owned by the authenticated user
--   - or the path's first folder is an active portal_token

create or replace function public.is_valid_portal_token(token_value text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from couples
    where portal_token::text = token_value
      and portal_token_enabled = true
  );
$$;

grant execute on function public.is_valid_portal_token(text) to anon, authenticated, service_role;

create or replace function public.is_own_couple(couple_id_value text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from couples
    where id::text = couple_id_value
      and user_id = auth.uid()
  );
$$;

grant execute on function public.is_own_couple(text) to authenticated, service_role;

-- portal-audio
drop policy if exists "Portal audio upload" on storage.objects;
create policy "Portal audio upload"
  on storage.objects for insert
  with check (
    bucket_id = 'portal-audio'
    and (
      public.is_valid_portal_token((storage.foldername(name))[1])
      or public.is_own_couple((storage.foldername(name))[1])
    )
  );

drop policy if exists "Portal audio update" on storage.objects;
create policy "Portal audio update"
  on storage.objects for update
  using (
    bucket_id = 'portal-audio'
    and (
      public.is_valid_portal_token((storage.foldername(name))[1])
      or public.is_own_couple((storage.foldername(name))[1])
    )
  )
  with check (
    bucket_id = 'portal-audio'
    and (
      public.is_valid_portal_token((storage.foldername(name))[1])
      or public.is_own_couple((storage.foldername(name))[1])
    )
  );

drop policy if exists "Portal audio delete" on storage.objects;
create policy "Portal audio delete"
  on storage.objects for delete
  using (
    bucket_id = 'portal-audio'
    and (
      public.is_valid_portal_token((storage.foldername(name))[1])
      or public.is_own_couple((storage.foldername(name))[1])
    )
  );

-- portal-files
drop policy if exists "Portal files upload" on storage.objects;
create policy "Portal files upload"
  on storage.objects for insert
  with check (
    bucket_id = 'portal-files'
    and (
      public.is_valid_portal_token((storage.foldername(name))[1])
      or public.is_own_couple((storage.foldername(name))[1])
    )
  );

drop policy if exists "Portal files update" on storage.objects;
create policy "Portal files update"
  on storage.objects for update
  using (
    bucket_id = 'portal-files'
    and (
      public.is_valid_portal_token((storage.foldername(name))[1])
      or public.is_own_couple((storage.foldername(name))[1])
    )
  )
  with check (
    bucket_id = 'portal-files'
    and (
      public.is_valid_portal_token((storage.foldername(name))[1])
      or public.is_own_couple((storage.foldername(name))[1])
    )
  );

drop policy if exists "Portal files delete" on storage.objects;
create policy "Portal files delete"
  on storage.objects for delete
  using (
    bucket_id = 'portal-files'
    and (
      public.is_valid_portal_token((storage.foldername(name))[1])
      or public.is_own_couple((storage.foldername(name))[1])
    )
  );

-- Drop the earlier, token-only variants from the prior attempt in this branch.
drop policy if exists "Portal audio upload with valid token" on storage.objects;
drop policy if exists "Portal audio update with valid token" on storage.objects;
drop policy if exists "Portal audio delete with valid token" on storage.objects;
drop policy if exists "Portal files upload with valid token" on storage.objects;
drop policy if exists "Portal files update with valid token" on storage.objects;
drop policy if exists "Portal files delete with valid token" on storage.objects;
