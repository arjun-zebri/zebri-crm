-- Proposals engine, Phase B: the proposal branding surface.
--
-- 1. New users see the Proposal tab (default enabled_surfaces gains it).
--    Existing rows are not rewritten: resolveEnabledSurfaces treats a
--    missing 'proposal' entry as enabled, the same rule the lead surface
--    uses, so nobody has to opt in.
-- 2. user_branding.proposal_role remembers the role chooser (mc, celebrant,
--    both) so it shows once.
-- 3. A proposal-media bucket for uploaded hero / video MP4 and WebM files
--    (50 MB, public read, owner-only write, same path rule as branding).

alter table public.user_branding
  alter column enabled_surfaces
  set default '["invoice", "contract", "portal", "vendorTimeline", "questionnaire", "lead", "proposal"]'::jsonb;

alter table public.user_branding
  add column if not exists proposal_role text null
  check (proposal_role is null or proposal_role in ('mc', 'celebrant', 'both'));

comment on column public.user_branding.proposal_role is
  'Role chosen on first open of the Proposal branding tab (mc | celebrant | both); null until chosen.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proposal-media', 'proposal-media', true, 52428800, array['video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy "Users upload their own proposal media"
on storage.objects for insert
with check (bucket_id = 'proposal-media' and auth.uid()::text = split_part(name, '/', 1));

create policy "Anyone can view proposal media"
on storage.objects for select
using (bucket_id = 'proposal-media');

create policy "Users update their own proposal media"
on storage.objects for update
using (bucket_id = 'proposal-media' and auth.uid()::text = split_part(name, '/', 1))
with check (bucket_id = 'proposal-media' and auth.uid()::text = split_part(name, '/', 1));

create policy "Users delete their own proposal media"
on storage.objects for delete
using (bucket_id = 'proposal-media' and auth.uid()::text = split_part(name, '/', 1));
