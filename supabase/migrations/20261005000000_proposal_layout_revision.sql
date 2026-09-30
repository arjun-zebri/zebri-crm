-- supabase/migrations/20261005000000_proposal_layout_revision.sql
--
-- Proposal Layout v2: optimistic-concurrency revision on proposals.
--
-- R3 gives a proposal its own copy of the template layout and opens the
-- same autosaving editor on it. That editor needs the same guard the
-- template editor already has (`proposal_templates.revision`,
-- `20260930000000_proposal_template_revision.sql`): every write carries
-- the revision it was based on, the update only matches
-- `layout_revision = base` and bumps it by one, and a miss comes back as
-- a conflict carrying the current row rather than clobbering it.
--
-- Why a new column and not `proposals.version`: `version` is the
-- resend counter (D13, "latest wins" for a proposal that has already gone
-- out). It moves for reasons that have nothing to do with a layout write,
-- so reusing it would make every resend look like a concurrent edit.
--
-- No new RLS: a column on an already owner-only table.
-- Not destructive. Deployed by CI `supabase db push` only.

alter table public.proposals
  add column if not exists layout_revision integer not null default 0;

comment on column public.proposals.layout_revision is
  'Optimistic-concurrency counter for layout writes: an editor write must match the revision it loaded and bumps it by one. Separate from `version`, which counts resends.';
