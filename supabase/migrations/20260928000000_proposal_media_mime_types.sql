-- Proposal Layout v2, Phase 2: widen the proposal-media bucket's allowed
-- MIME types to match what the template editor actually uploads.
--
-- `20260924000000_proposal_surface.sql` created `proposal-media` for the
-- hero/video block source only (video/mp4, video/webm). Phase 2's node
-- bars (features/proposals/editor/bars/) now also upload images and audio
-- through features/proposals/data/media.ts (`MEDIA_LIMITS`), but the
-- bucket itself was never widened to accept them - every image or audio
-- upload passes the client-side MEDIA_LIMITS check and then gets rejected
-- by Supabase Storage at request time. security.md (Phase B section)
-- flagged this as a known gap; this migration closes it.
--
-- allowed_mime_types becomes the union of every kind MEDIA_LIMITS allows:
-- video/mp4, video/webm (video + background, 50MB - existing),
-- image/jpeg, image/png, image/webp, image/gif (image, 10MB - new),
-- audio/mpeg, audio/mp4, audio/x-m4a, audio/wav (audio, 25MB - new).
--
-- file_size_limit stays 52428800 (50MB): that's the bucket-level cap,
-- sized for the largest kind (video/background). MEDIA_LIMITS enforces
-- the smaller per-kind caps (image 10MB, audio 25MB) client-side before
-- any upload request opens; the bucket only needs to guard the ceiling.
--
-- Idempotent: keyed on id = 'proposal-media', safe to re-run.

update storage.buckets
   set allowed_mime_types = array[
         'video/mp4', 'video/webm',
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav'
       ],
       file_size_limit = 52428800
 where id = 'proposal-media';
