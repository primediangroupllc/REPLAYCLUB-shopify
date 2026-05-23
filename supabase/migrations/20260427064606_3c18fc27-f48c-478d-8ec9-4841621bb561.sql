REVOKE EXECUTE ON FUNCTION public.issue_threshold_coupons_for_email(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_coupon(uuid, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_loyalty_coupons() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bookings_issue_loyalty_coupons() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.loyalty_threshold_percent(integer) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.admin_list_loyalty_coupons() TO authenticated;