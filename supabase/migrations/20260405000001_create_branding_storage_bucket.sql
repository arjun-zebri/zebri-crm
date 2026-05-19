-- Create the branding storage bucket for logo uploads
insert into storage.buckets (id, name, public, avif_autodetection, file_size_limit)
values ('branding', 'branding', true, false, 2097152)
on conflict (id) do nothing;

-- Users can upload their own logos
create policy "Users can upload their own logos"
on storage.objects for insert
with check (
  bucket_id = 'branding'
  -- Original committed form `auth.uid()::text || '/' in name` was invalid SQL
  -- (misused IN) and never replayed; prod was hand-patched. Corrected here to
  -- the valid form that the immediately-following migration
  -- 20260405000002_fix_branding_bucket_rls_policies.sql drops & recreates, so
  -- the end state is unchanged and the chain now replays cleanly. (§7.9)
  and auth.uid()::text = split_part(name, '/', 1)
);

-- Anyone can view logos (public read)
create policy "Anyone can view logos"
on storage.objects for select
using (bucket_id = 'branding');

-- Users can update their own logos
create policy "Users can update their own logos"
on storage.objects for update
with check (
  bucket_id = 'branding'
  and auth.uid()::text = split_part(name, '/', 1)
);

-- Users can delete their own logos
create policy "Users can delete their own logos"
on storage.objects for delete
using (
  bucket_id = 'branding'
  and auth.uid()::text = split_part(name, '/', 1)
);
