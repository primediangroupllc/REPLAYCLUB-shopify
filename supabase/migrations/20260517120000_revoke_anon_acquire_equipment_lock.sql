-- =========================================================================
-- Audit #4 — anon DoS hardening on the equipment-lock booking RPC.
--
-- public.acquire_equipment_lock is SECURITY DEFINER and was left executable
-- by anon in the conservative P0.3 lockdown (20260428051056), pending a
-- second-pass audit to confirm no pre-auth browser path depended on it.
--
-- That second pass (2026-05-17) confirmed: the function's ONLY caller is the
-- create-equipment-rental-payment edge function, which builds its client with
-- the service-role key and therefore bypasses EXECUTE grants entirely. No
-- browser code path invokes it. Revoking from anon + authenticated closes the
-- DoS vector (an unauthenticated client could otherwise burn equipment
-- availability by spamming short-TTL locks) with zero impact on booking.
--
-- NOTE: acquire_slot_lock is intentionally NOT revoked here. It still has a
-- now-effectively-dead browser fallback caller in BookingModal.tsx; revoking
-- it is deferred until that caller is formally removed (inline-rebuild Stage 6).
-- =========================================================================

REVOKE EXECUTE ON FUNCTION public.acquire_equipment_lock(text, date, integer, text, integer) FROM anon, authenticated;
