ALTER TABLE public.id_verifications
  ALTER COLUMN id_image_path DROP NOT NULL,
  ALTER COLUMN id_capture_method DROP NOT NULL;

ALTER TABLE public.id_verifications
  ADD COLUMN IF NOT EXISTS stripe_verification_session_id text;

CREATE INDEX IF NOT EXISTS idx_id_verifications_stripe_session
  ON public.id_verifications (stripe_verification_session_id)
  WHERE stripe_verification_session_id IS NOT NULL;