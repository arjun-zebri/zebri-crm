-- Add an optional short label to events (e.g. "Ceremony", "Reception",
-- "Engagement party"). Couples regularly have multiple events on the same
-- day; venue alone doesn't distinguish them in the events list, calendar
-- tiles or pickers. `title` is purely a display affordance - venue stays
-- the canonical place identifier; reads fall back to venue when title is
-- null, so existing rows render unchanged.

alter table events add column if not exists title text;
