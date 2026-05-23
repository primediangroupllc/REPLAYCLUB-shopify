ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS staff_check_in_note text,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_confirmation_number
  ON public.bookings (confirmation_number);

-- Ensure admins can update check-in fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings'
      AND policyname='Admins can check in bookings'
  ) THEN
    CREATE POLICY "Admins can check in bookings"
      ON public.bookings
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;