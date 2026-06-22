-- ────────────────────────────────────────────────────────────────
-- Email Templates feature
--
-- Reusable, per-MC email templates usable both in the automation
-- `send_email` action and the manual "Send email" compose flow.
--
-- The body is stored as TipTap JSON (mirroring `contracts.content`),
-- where each mention node's `attrs.id` is a namespaced automation
-- variable key (e.g. `couple.primary_name`, `event.date | friendly`).
-- The subject is a lightweight mustache string (`{{ couple.name }}`).
--
-- Attachments (v1): dynamic linked-doc PDFs are configured per-send
-- (no storage needed — generated on the fly), while static uploads
-- live in the private `email-template-files` bucket and are tracked
-- by `email_template_files`.
--
-- The seeded starter library + the `automation_waits` `missing_variables`
-- reason ship in later migrations (Steps 2 and 5).
-- ────────────────────────────────────────────────────────────────

-- email_templates - the saved template library, one set per MC
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  -- Templated subject line. Mustache `{{ namespace.key }}` tokens,
  -- resolved + missing-var-checked by the same resolver as the body.
  subject text not null default '',
  -- TipTap JSON body. Mention nodes carry a namespaced variable key
  -- in `attrs.id`.
  content jsonb not null default '{}'::jsonb,
  -- Lifecycle stage tag — groups the library + suggests templates in
  -- the matching automation trigger. NULL = untagged.
  lifecycle_stage text check (
    lifecycle_stage in (
      'enquiry', 'quote', 'booking', 'planning', 'wedding_week', 'follow_up'
    )
  ),
  -- True when this row originated from the seeded starter library.
  -- Provenance badge only — starters are fully editable.
  is_starter boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- email_template_files - metadata for static uploaded attachments.
-- The binary lives in the `email-template-files` storage bucket at
-- `{user_id}/{template_id}/{id}`.
create table if not exists public.email_template_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.email_templates(id) on delete cascade,
  file_name text not null,
  file_size integer not null,
  mime_type text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- RLS — base owner policy on both owned tables
alter table public.email_templates enable row level security;
alter table public.email_template_files enable row level security;

create policy "Users manage own email_templates"
  on public.email_templates for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own email_template_files"
  on public.email_template_files for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Indexes
create index if not exists email_templates_user_id_idx
  on public.email_templates(user_id);
create index if not exists email_templates_stage_idx
  on public.email_templates(user_id, lifecycle_stage)
  where lifecycle_stage is not null;
create index if not exists email_template_files_user_id_idx
  on public.email_template_files(user_id);
create index if not exists email_template_files_template_id_idx
  on public.email_template_files(template_id);

-- keep updated_at fresh on email_templates
create or replace function public.touch_email_templates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.touch_email_templates_updated_at();

-- ────────────────────────────────────────────────────────────────
-- Private storage bucket for static attachment uploads
-- Path convention: {user_id}/{template_id}/{file_id}
-- 25 MB cap, document/image MIME whitelist.
-- ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-template-files',
  'email-template-files',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;

-- Owner-only access: the first path segment is the owner's user id.
create policy "Users upload own email template files"
  on storage.objects for insert
  with check (
    bucket_id = 'email-template-files'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users read own email template files"
  on storage.objects for select
  using (
    bucket_id = 'email-template-files'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users update own email template files"
  on storage.objects for update
  using (
    bucket_id = 'email-template-files'
    and auth.uid()::text = split_part(name, '/', 1)
  )
  with check (
    bucket_id = 'email-template-files'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users delete own email template files"
  on storage.objects for delete
  using (
    bucket_id = 'email-template-files'
    and auth.uid()::text = split_part(name, '/', 1)
  );
