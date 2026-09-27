-- One automatic enrolment per template per couple, enforced by Postgres.
--
-- `instantiate.ts` checked for an existing instance and then inserted.
-- Two bus events for the same couple in the same tick both passed the
-- check, so the couple got two instances and two of every email. A
-- check-then-insert cannot fix that; a unique index can.
--
-- `allow_reapply` is a template column, so the index cannot read it.
-- Instead the writer stamps `dedupe_key` with the template id only when
-- re-apply is NOT allowed, and leaves it null when duplicates are
-- legitimate. Null never collides, so both rules live in one index.

alter table public.workflow_instances
  add column if not exists dedupe_key uuid;

comment on column public.workflow_instances.dedupe_key is
  'Template id when this enrolment must be unique for the couple, else null.';

-- Created before the backfill so existing duplicates cannot block it.
create unique index if not exists workflow_instances_one_per_template_couple_idx
  on public.workflow_instances (couple_id, dedupe_key)
  where dedupe_key is not null and status <> 'cancelled';

-- Backfill the oldest surviving enrolment in each group only. Existing
-- duplicates (production has some) keep a null key: they are already
-- running and stamping them would fail the index. New applies are
-- guarded from here on.
with ranked as (
  select
    i.id,
    row_number() over (
      partition by i.couple_id, i.template_id
      order by i.applied_at, i.id
    ) as rn
  from public.workflow_instances i
  join public.workflow_templates t on t.id = i.template_id
  where i.template_id is not null
    and i.couple_id is not null
    and i.status <> 'cancelled'
    and coalesce(t.allow_reapply, false) = false
)
update public.workflow_instances i
set dedupe_key = i.template_id
from ranked
where ranked.id = i.id and ranked.rn = 1;
