-- Stop a couple pointing at another MC's package.
--
-- Foreign keys are checked with elevated privileges and ignore RLS, so the
-- owner-only `auth.uid() = user_id` policy on `couples` still accepted a
-- `selected_package_id` belonging to a different MC: the FK found the row
-- even though the writer could never read it. That both links across tenants
-- and confirms another MC's package id exists. Same class of hole as the
-- `couple_time_entries` couple_id guard.
--
-- The fix is a WITH CHECK on the writes that can set the column, requiring
-- the referenced package to be one the writer owns. The insert policy needs
-- it too: a couple can be created with a package already chosen.
--
-- Null stays allowed everywhere: most couples have no package.

create or replace function public._owns_package_or_null(p_package_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_package_id is null
      or exists (
        select 1 from packages
        where id = p_package_id
          and user_id = auth.uid()
      );
$$;

comment on function public._owns_package_or_null(uuid) is
  'True when the package is the caller''s own, or when no package is set. '
  'Used by the couples RLS policies: foreign keys ignore RLS, so without '
  'this an MC could reference another MC''s package.';

drop policy if exists "Users can insert their own couples" on public.couples;
create policy "Users can insert their own couples"
  on public.couples
  for insert
  with check (
    auth.uid() = user_id
    and _owns_package_or_null(selected_package_id)
  );

drop policy if exists "Users can update their own couples" on public.couples;
create policy "Users can update their own couples"
  on public.couples
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and _owns_package_or_null(selected_package_id)
  );
