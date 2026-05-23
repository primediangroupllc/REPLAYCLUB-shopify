-- =========================================================================
-- P0.3 — SECURITY DEFINER grant lockdown (conservative cut)
-- =========================================================================
-- Tier A: revoke from BOTH anon and authenticated (service-role only)
-- =========================================================================

-- PGMQ helpers (called by edge functions using service_role)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;

-- Maintenance / cron functions
REVOKE EXECUTE ON FUNCTION public.capture_integrity_snapshot() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_slow_queries(numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_slot_locks() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_stripe_idempotency() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_counters() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_waitlist_for_slot(text, date, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM anon, authenticated;

-- Trigger functions (only ever called by Postgres trigger machinery)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_admin_sereda() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.categorize_failure_report() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_slot_lock_released() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_vote_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_waveform_generation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_abandoned_slot_lock() FROM anon, authenticated;

-- Orphaned / edge-internal functions (greps confirmed no client callers)
REVOKE EXECUTE ON FUNCTION public.is_blocked(text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_event_rsvp_with_capacity(uuid, text) FROM anon, authenticated;

-- =========================================================================
-- Tier B: revoke from anon only, keep authenticated
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_loyalty_info(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_referral_credits(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_session_invite_by_booking(uuid) FROM anon;

-- =========================================================================
-- NOTE for future maintainers:
-- Booking-flow RPCs (acquire_slot_lock, release_slot_lock, check_slot_available,
-- acquire_equipment_lock, release_equipment_locks, get_active_slot_locks,
-- get_active_equipment_locks) are intentionally NOT revoked here. The booking
-- modal may mount before auth resolves — second-pass audit should confirm
-- whether the auth gate is bulletproof before locking these down.
--
-- Public reads (get_meta_pixel_id, get_stripe_mode, get_booking_density_settings,
-- get_day_booking_count, get_day_booked_times, get_unavailable_equipment,
-- get_event_attendance, get_latest_video_url) remain executable by anon
-- because they are called pre-auth on landing pages and the booking modal.
--
-- Token-gated functions (get_*_by_token, get_host_*, host_check_in,
-- log_host_access, get_session_messages_by_token) remain executable by anon
-- because access control lives inside the function body via the token check.
-- =========================================================================