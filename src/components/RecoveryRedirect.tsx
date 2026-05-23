import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Global interceptor: if a Supabase password-recovery payload lands on any
 * route other than /reset-password (e.g. because the email link redirected
 * to the site URL after the token was consumed), forward the user to the
 * reset-password page with all params preserved so the recovery flow can
 * resume instead of dumping them on the login/signup screen.
 */
const RecoveryRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/reset-password") return;

    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));

    const type = search.get("type") ?? hash.get("type");
    const hasTokenHash = !!(search.get("token_hash") ?? hash.get("token_hash"));
    const hasCode = !!search.get("code");
    const hasAccessToken = !!hash.get("access_token");
    const errorCode = search.get("error_code") ?? hash.get("error_code");
    const errorDescription = search.get("error_description") ?? hash.get("error_description");

    const looksLikeRecovery =
      type === "recovery" ||
      ((hasTokenHash || hasCode || hasAccessToken) && type === "recovery") ||
      (errorCode && /otp|recovery|expired/i.test(`${errorCode} ${errorDescription ?? ""}`));

    if (!looksLikeRecovery) return;

    const target = `/reset-password${location.search}${location.hash}`;
    navigate(target, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
};

export default RecoveryRedirect;
