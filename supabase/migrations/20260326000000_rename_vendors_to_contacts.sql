-- Rename vendors table to contacts
alter table public.vendors rename to contacts;

-- Rename event_vendors to event_contacts
alter table public.event_vendors rename to event_contacts;

-- Rename couple_vendors to couple_contacts
alter table public.couple_vendors rename to couple_contacts;

-- Rename vendor_id column in event_contacts
alter table public.event_contacts rename column vendor_id to contact_id;

-- Rename vendor_id column in couple_contacts
alter table public.couple_contacts rename column vendor_id to contact_id;

-- Rename related_vendor_id in tasks (if the column exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'tasks' and column_name = 'related_vendor_id'
  ) then
    alter table public.tasks rename column related_vendor_id to related_contact_id;
  end if;
end $$;
