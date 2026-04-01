-- Add pricing to events and lead_source to couples for demo data

-- Set prices on all events (realistic MC pricing in AUD)
UPDATE events SET price = 1800 WHERE venue = 'The Botanical Gardens' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1500 WHERE venue = 'Taronga House Wedding Venue' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 2200 WHERE venue = 'Summer Hill Estate' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1900 WHERE venue = 'Bannisters Port Macquarie' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1600 WHERE venue = 'Darling Harbour Events' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1400 WHERE venue = 'Edgecliff Estate' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1700 WHERE venue = 'Bundanoon' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 2000 WHERE venue = 'Watsons Bay' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1850 WHERE venue = 'The Sebel Broken Hill' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1650 WHERE venue = 'Terrey Hills Estate' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1750 WHERE venue = 'The Rocks' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1550 WHERE venue = 'Centennial Vineyards' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1950 WHERE venue = 'Somerley' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1600 WHERE venue = 'Bona Vista Estate' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 2100 WHERE venue = 'Centennial Parklands' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1800 WHERE venue = 'Hydro Majestic Hotel' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 2000 WHERE venue = 'Lilianfels Blue Mountains' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1700 WHERE venue = 'Dockside Garden Venue' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1850 WHERE venue = 'Carrington Hotel' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';
UPDATE events SET price = 1500 WHERE venue = 'Pier One Sydney' AND user_id = '9524e31d-d35b-4ea4-b775-eea8dcf0dde3';

-- Set lead_source on all current couples
UPDATE couples SET lead_source = 'referral' WHERE email = 'sarah.johnson@email.com';
UPDATE couples SET lead_source = 'website' WHERE email = 'emma.chen@email.com';
UPDATE couples SET lead_source = 'social_media' WHERE email = 'olivia.m@email.com';
UPDATE couples SET lead_source = 'word_of_mouth' WHERE email = 'jessica.wilson@email.com';
UPDATE couples SET lead_source = 'referral' WHERE email = 'sophie.taylor@email.com';
UPDATE couples SET lead_source = 'venue_partner' WHERE email = 'grace.lee@email.com';
UPDATE couples SET lead_source = 'website' WHERE email = 'hannah.b@email.com';
UPDATE couples SET lead_source = 'referral' WHERE email = 'mia.thompson@email.com';
UPDATE couples SET lead_source = 'social_media' WHERE email = 'charlotte.r@email.com';
UPDATE couples SET lead_source = 'wedding_expo' WHERE email = 'amelia.m@email.com';
UPDATE couples SET lead_source = 'referral' WHERE email = 'isabella.g@email.com';
UPDATE couples SET lead_source = 'word_of_mouth' WHERE email = 'ava.anderson@email.com';
UPDATE couples SET lead_source = 'website' WHERE email = 'sophia.t@email.com';
UPDATE couples SET lead_source = 'social_media' WHERE email = 'evelyn.j@email.com';
UPDATE couples SET lead_source = 'venue_partner' WHERE email = 'lily.white@email.com';
UPDATE couples SET lead_source = 'referral' WHERE email = 'chloe.h@email.com';
UPDATE couples SET lead_source = 'word_of_mouth' WHERE email = 'nora.martin@email.com';
UPDATE couples SET lead_source = 'wedding_expo' WHERE email = 'abigail.p@email.com';
UPDATE couples SET lead_source = 'website' WHERE email = 'harper.scott@email.com';
UPDATE couples SET lead_source = 'venue_partner' WHERE email = 'victoria.green@email.com';
