-- Packages v2: make packages carry the commercial details a wedding MC
-- actually sells with, so applying a package into a quote/invoice needs
-- no re-typing:
--
--   packages
--     deposit_percent          -  package-level booking-fee rule (e.g. 30
--                                 for "30% to secure the date"). Pre-fills
--                                 the invoice builder's payment schedule
--                                 when the package is applied. NULL = no
--                                 default schedule.
--     gst_inclusive            -  whether the package's prices already
--                                 include GST. Applying an inclusive
--                                 package turns the builder's GST line off;
--                                 an exclusive one keeps GST 10% on top.
--                                 Defaults true (AU consumer pricing is
--                                 normally quoted inc. GST).
--     archived_at              -  soft retirement: archived packages keep
--                                 their history but drop out of the default
--                                 list and the builders' apply pickers.
--     weekend_loading_percent  -  peak-rate loading (e.g. 15 for a
--                                 "Saturday +15%" rate). Applying the
--                                 package appends a transparent loading
--                                 line item the MC can delete off-peak.
--
--   package_items
--     optional  -  marks an add-on (rehearsal, extra hour, travel) that is
--                  offered alongside the base package. The builders let
--                  the MC tick which add-ons to include on apply.
--     quantity  -  unit count; `amount` stays the PER-UNIT price so
--                  existing rows (default 1) are unchanged. Line total is
--                  quantity x amount, flattened to "N x description" when
--                  applied (quote_items / the builders carry no qty).
--
--   quotes
--     source_package_id  -  provenance for conversion stats ("used in X
--                            quotes, Y accepted"). Items are still applied
--                            by snapshot; this FK never feeds rendering, so
--                            a later package edit can't change a sent
--                            quote. SET NULL on package delete keeps the
--                            quote intact.
--
-- Additive and non-destructive: no `@ALLOW_DESTRUCTIVE` marker required.
-- All columns land on owner-scoped tables whose existing RLS policies
-- cover them; no policy changes needed.

alter table packages add column if not exists deposit_percent numeric(5,2);
alter table packages add column if not exists gst_inclusive boolean not null default true;
alter table packages add column if not exists archived_at timestamptz;
alter table packages add column if not exists weekend_loading_percent numeric(5,2);

alter table package_items add column if not exists optional boolean not null default false;
alter table package_items add column if not exists quantity numeric(8,2) not null default 1.00;

alter table quotes add column if not exists source_package_id uuid references packages(id) on delete set null;

-- FK gets an index (project convention): also serves the per-package
-- conversion-stats lookup.
create index if not exists quotes_source_package_id_idx on quotes(source_package_id);
