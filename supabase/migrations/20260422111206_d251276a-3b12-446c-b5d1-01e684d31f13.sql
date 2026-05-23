-- Storage bucket hardening: set file_size_limit and allowed_mime_types
UPDATE storage.buckets
SET file_size_limit = 5 * 1024 * 1024, -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'avatars';

UPDATE storage.buckets
SET file_size_limit = 8 * 1024 * 1024, -- 8 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'talent-images';

UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024, -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'event-covers';

UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024, -- already 10 MB
    allowed_mime_types = ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/ogg','video/mp4','video/quicktime']
WHERE id = 'challenge-clips';

UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024, -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
WHERE id = 'id-verification';

UPDATE storage.buckets
SET file_size_limit = 2 * 1024 * 1024, -- 2 MB
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']
WHERE id = 'consent-signatures';

UPDATE storage.buckets
SET file_size_limit = 1024 * 1024 * 1024, -- 1 GB
    allowed_mime_types = ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/ogg','audio/flac','audio/x-flac']
WHERE id = 'mixes';

UPDATE storage.buckets
SET file_size_limit = 200 * 1024 * 1024, -- 200 MB
    allowed_mime_types = ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/ogg','image/jpeg','image/png','image/webp']
WHERE id = 'roster-submissions';

UPDATE storage.buckets
SET file_size_limit = 5 * 1024 * 1024, -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
WHERE id = 'email-assets';