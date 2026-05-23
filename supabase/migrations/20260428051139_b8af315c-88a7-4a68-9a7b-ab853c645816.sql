-- =========================================================================
-- P0.3 (corrected) — Revoke from PUBLIC, re-grant to authenticated for Tier B
-- =========================================================================
-- Tier A: revoke from PUBLIC (service-role / triggers only)
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.capture_integrity_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.capture_slow_queries(numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_slot_locks() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_stripe_idempotency() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_counters() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_waitlist_for_slot(text, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_admin_sereda() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.categorize_failure_report() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_slot_lock_released() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_vote_count() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_waveform_generation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.capture_abandoned_slot_lock() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.is_blocked(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_event_rsvp_with_capacity(uuid, text) FROM PUBLIC;

-- =========================================================================
-- Tier B: revoke from PUBLIC, then explicitly re-grant to authenticated
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_loyalty_info(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_loyalty_info(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_referral_credits(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_referral_credits(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_session_invite_by_booking(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_session_invite_by_booking(uuid) TO authenticated;