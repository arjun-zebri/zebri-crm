-- Drop all existing branding bucket policies
drop policy if exists "Users can upload their own logos" on storage.objects;
drop policy if exists "Anyone can view logos" on storage.objects;
drop policy if exists "Users can update their own logos" on storage.objects;
drop policy if exists "Users can delete their own logos" on storage.objects;

-- Single policy covering all write operations for authenticated users on their own files
create policy "Users can manage their own logos"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'branding'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'branding'
  and auth.uid()::text = split_part(name, '/', 1)
);

-- Separate public read policy
create policy "Anyone can view logos"
on storage.objects
for select
to anon
using (bucket_id = 'branding');
