
DROP POLICY IF EXISTS "Public read active slot locks (availability only)" ON public.slot_locks;
DROP POLICY IF EXISTS "Public read active equipment locks (availability only)" ON public.equipment_locks;

ALTER VIEW public.slot_locks_public SET (security_invoker = off);
ALTER VIEW public.equipment_locks_public SET (security_invoker = off);
