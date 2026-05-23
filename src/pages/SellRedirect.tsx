import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * /sell/:token — Host sales link.
 * Stores the host token in sessionStorage for sales attribution and
 * redirects the buyer to the public event page (or /events if no event).
 */
const SellRedirect = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate("/events", { replace: true });
      return;
    }
    (async () => {
      try {
        sessionStorage.setItem("rc_host_referral_token", token);
      } catch {
        /* storage may be disabled */
      }
      const { data } = await (supabase as any).rpc("get_host_event", { p_token: token });
      const eventId = (data as Array<{ event_id: string }> | null)?.[0]?.event_id;
      navigate(eventId ? `/events/${eventId}` : "/events", { replace: true });
    })();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-xs text-muted-foreground font-body">
      Redirecting to event…
    </div>
  );
};

export default SellRedirect;
