-- The branding bucket was created with a 2MB file_size_limit aimed at logos,
-- but the branding editor now also stores header banner images. Uploads
-- between 2MB and the editor's 4MB client-side cap were rejected by storage
-- with a 400 before the friendlier client check could fire.
update storage.buckets
   set file_size_limit = 5242880 -- 5 MB, gives 1 MB headroom over the 4 MB editor cap
 where id = 'branding';
