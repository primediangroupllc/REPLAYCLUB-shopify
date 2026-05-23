ALTER TABLE public.session_guests
  ADD COLUMN IF NOT EXISTS id_photo_path text,
  ADD COLUMN IF NOT EXISTS id_verified text NOT NULL DEFAULT 'pending';