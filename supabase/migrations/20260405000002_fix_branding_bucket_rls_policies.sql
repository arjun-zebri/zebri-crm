-- Drop existing RLS policies that use foldername()
drop policy if exists "Users can upload their own logos" on storage.objects;
drop policy if exists "Anyone can view logos" on storage.objects;
drop policy if exists "Users can update their own logos" on storage.objects;
drop policy if exists "Users can delete their own logos" on storage.objects;

-- Recreate with more reliable split_part() function
create policy "Users can upload their own logos"
on storage.objects for insert
with check (
  bucket_id = 'branding'
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "Anyone can view logos"
on storage.objects for select
using (bucket_id = 'branding');

create policy "Users can update their own logos"
on storage.objects for update
with check (
  bucket_id = 'branding'
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "Users can delete their own logos"
on storage.objects for delete
using (
  bucket_id = 'branding'
  and auth.uid()::text = split_part(name, '/', 1)
);
