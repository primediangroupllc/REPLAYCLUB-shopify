-- Add confirmation_number and checked_in tracking to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS checked_in_by UUID;

CREATE INDEX IF NOT EXISTS idx_bookings_confirmation_number ON public.bookings(confirmation_number);

-- Function to generate a unique 7-digit confirmation number
CREATE OR REPLACE FUNCTION public.generate_confirmation_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    new_code := lpad(floor(random() * 10000000)::TEXT, 7, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE confirmation_number = new_code);
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique confirmation number';
    END IF;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Trigger to auto-assign confirmation number on insert
CREATE OR REPLACE FUNCTION public.assign_confirmation_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.confirmation_number IS NULL THEN
    NEW.confirmation_number := public.generate_confirmation_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_confirmation_number ON public.bookings;
CREATE TRIGGER trg_assign_confirmation_number
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_confirmation_number();

-- Backfill existing bookings without a confirmation number
UPDATE public.bookings
SET confirmation_number = public.generate_confirmation_number()
WHERE confirmation_number IS NULL;

-- Allow admins to update bookings (for check-in) — already covered by existing admin update policy.
