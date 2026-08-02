-- Per-category colour, so the Time tab's breakdown bar has segments a
-- reader can tell apart.
--
-- The original table deliberately had no colour column: couple statuses
-- are this product's coloured vocabulary and a second one competes with
-- it. That holds for a *fixed app palette*; it does not hold for a
-- colour the MC picks, which is the same hex + picker model as branding.
-- So colour is user-owned here, stored as hex, not a named palette key
-- like couple_statuses.color or task_groups.color.
--
-- Additive only: nullable column, one CHECK, one backfill. Nothing is
-- dropped and no existing value is overwritten.

alter table public.time_categories
  add column if not exists color text;

-- Uppercase #RRGGBB only. `normalizeHex` in components/ui/color-popover
-- already emits exactly this shape, so a row that trips this constraint
-- is a bug in a writer rather than something a user typed.
alter table public.time_categories
  drop constraint if exists time_categories_color_hex;

alter table public.time_categories
  add constraint time_categories_color_hex
  check (color is null or color ~ '^#[0-9A-F]{6}$');

-- Backfill every existing category so the bar is readable on the next
-- page load, rather than all-grey until someone opens six pickers.
--
-- Ordered by position so a user's starter set (Meeting, Call, Admin,
-- Travel, Rehearsal, Ceremony) always lands on the same colours, and
-- partitioned by user so every MC gets slot 1 rather than continuing a
-- global sequence.
--
-- These eight are the validated categorical order from the dataviz
-- palette, kept in sync with DEFAULT_CATEGORY_COLORS in
-- lib/time-tracking/colors.ts. They pass adjacent-pair colour-blind
-- separation in that order, so the rotation must not be re-sorted.
with ordered as (
  select
    id,
    row_number() over (
      partition by user_id
      order by position, created_at, id
    ) - 1 as slot
  from public.time_categories
  where color is null
)
update public.time_categories t
set color = (array[
  '#2A78D6',  -- blue
  '#EB6834',  -- orange
  '#1BAF7A',  -- aqua
  '#EDA100',  -- yellow
  '#E87BA4',  -- magenta
  '#008300',  -- green
  '#4A3AA7',  -- violet
  '#E34948'   -- red
])[(o.slot % 8) + 1]
from ordered o
where t.id = o.id;
