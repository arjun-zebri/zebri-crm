-- @ALLOW_DESTRUCTIVE: pricing moved from events to quotes/invoices; events.price
-- was a transitional column no longer read or written by the app. Already
-- applied on prod and staging long before the safety gate landed (Phase 0.7).
ALTER TABLE events DROP COLUMN IF EXISTS price;
