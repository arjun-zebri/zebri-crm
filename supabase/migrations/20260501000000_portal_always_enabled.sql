-- Make couple portal always enabled by default
ALTER TABLE couples ALTER COLUMN portal_token_enabled SET DEFAULT true;
UPDATE couples SET portal_token_enabled = true;
