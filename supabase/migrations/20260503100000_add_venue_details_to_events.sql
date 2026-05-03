alter table events
  add column if not exists venue_phone text,
  add column if not exists venue_website text,
  add column if not exists venue_lat double precision,
  add column if not exists venue_lng double precision;
