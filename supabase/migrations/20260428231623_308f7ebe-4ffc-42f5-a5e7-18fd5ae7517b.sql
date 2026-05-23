DELETE FROM public.id_verifications a
USING public.id_verifications b
WHERE a.booking_id = b.booking_id
  AND a.created_at < b.created_at;

ALTER TABLE public.id_verifications
  ADD CONSTRAINT id_verifications_booking_id_key UNIQUE (booking_id);