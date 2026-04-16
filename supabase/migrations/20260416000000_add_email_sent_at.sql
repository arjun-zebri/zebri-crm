-- Add email_sent_at column to quotes and invoices
-- Tracks when the MC last sent a share email to the couple

alter table quotes add column email_sent_at timestamptz;
alter table invoices add column email_sent_at timestamptz;
