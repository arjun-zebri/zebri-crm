-- Update couples status values: new, contacted, confirmed, paid, complete
-- Migrate existing data first
update public.couples set status = 'confirmed' where status = 'quoted';
update public.couples set status = 'new' where status = 'lost';

-- Drop existing check constraint and add new one
alter table public.couples drop constraint if exists couples_status_check;
alter table public.couples add constraint couples_status_check
  check (status in ('new', 'contacted', 'confirmed', 'paid', 'complete'));
