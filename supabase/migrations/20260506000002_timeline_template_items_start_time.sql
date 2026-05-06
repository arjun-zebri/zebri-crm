-- Add start_time to timeline template items so templates can carry scheduled times

alter table timeline_template_items
  add column if not exists start_time time;
