-- P0.2 — Lock down challenge-clips bucket.
-- The bucket previously had `public = true` with NO SELECT policy, which made
-- every uploaded clip world-readable via the public URL. The bucket is empty
-- today and the leaderboard feature is unbuilt in the client, so we are
-- shipping the safe baseline now: private bucket + owner SELECT + admin SELECT.
--
-- NOTE FOR THE NEXT DEVELOPER:
-- When the public voting leaderboard ships, add a FOURTH SELECT policy that
-- allows anyone to read clips for *published* challenge entries. The cleanest
-- shape is a boolean visibility flag on `public.challenges` (e.g. `is_published`
-- or `status = 'published'`) and a policy roughly like:
--
--   CREATE POLICY "Public read clips of published challenge entries"
--     ON storage.objects FOR SELECT TO anon, authenticated
--     USING (
--       bucket_id = 'challenge-clips'
--       AND EXISTS (
--         SELECT 1
--         FROM public.challenge_entries ce
--         JOIN public.challenges c ON c.id = ce.challenge_id
--         WHERE c.is_published = true
--           AND ce.audio_url LIKE '%' || storage.objects.name
--       )
--     );
--
-- Until then, the leaderboard cannot read clips, which is the intended
-- behavior (the feature is not live).

UPDATE storage.buckets SET public = false WHERE id = 'challenge-clips';

-- Owner-scoped SELECT (matches the existing INSERT policy's folder index).
DROP POLICY IF EXISTS "challenge-clips owner read" ON storage.objects;
CREATE POLICY "challenge-clips owner read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'challenge-clips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admin SELECT (full visibility for moderation / disputes).
DROP POLICY IF EXISTS "challenge-clips admin read" ON storage.objects;
CREATE POLICY "challenge-clips admin read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'challenge-clips'
  AND public.has_role(auth.uid(), 'admin')
);