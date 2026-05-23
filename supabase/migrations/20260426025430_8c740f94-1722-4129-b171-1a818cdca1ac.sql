-- Drop trigger first (depends on assign_confirmation_number)
DROP TRIGGER IF EXISTS assign_confirmation_number_trigger ON public.bookings;
DROP TRIGGER IF EXISTS bookings_assign_confirmation_number ON public.bookings;
DROP TRIGGER IF EXISTS trg_assign_confirmation_number ON public.bookings;

-- Drop the helpers
DROP FUNCTION IF EXISTS public.assign_confirmation_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_confirmation_number() CASCADE;

-- Remove the column + index
DROP INDEX IF EXISTS public.idx_bookings_confirmation_number;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS confirmation_number;

-- Mirror booking check-in fields on equipment_rentals
ALTER TABLE public.equipment_rentals
  ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_check_in_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='equipment_rentals'
      AND policyname='Admins can check in rentals'
  ) THEN
    CREATE POLICY "Admins can check in rentals"
      ON public.equipment_rentals
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;