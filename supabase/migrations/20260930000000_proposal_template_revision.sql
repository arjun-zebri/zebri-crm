-- Proposal Layout v2: optimistic-concurrency revision on templates.
--
-- The template editor autosaves the whole `layout` with a plain
-- `UPDATE ... WHERE id = ...`, so any tab holding an older copy could
-- overwrite a newer one wholesale (2026-09-20 "lost on refresh" root
-- cause: the beforeunload beacon raced the reload's read, the reloaded
-- page then autosaved its stale copy over the beacon's newer one).
--
-- `revision` is the guard: every editor write carries the revision it was
-- based on, the update only matches `revision = base` and bumps it by one,
-- and a miss comes back as a conflict carrying the current row so the
-- client can reconcile instead of clobber. The beacon path matches on the
-- same guard but does NOT bump (see `layout-beacon/route.ts` for why).
--
-- No new RLS: a column on an already owner-only table. Additive and
-- idempotent, safe to re-run.

alter table public.proposal_templates
  add column if not exists revision integer not null default 0;

comment on column public.proposal_templates.revision is
  'Optimistic-concurrency counter for layout writes: an editor write must match the revision it loaded and bumps it by one.';
