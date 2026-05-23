import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2 } from "lucide-react";
import TicketPass, { type TicketPassData } from "@/components/TicketPass";
import SeoHead from "@/components/SeoHead";

type State = "verifying" | "success" | "error";

const EventConfirmation = () => {
  const { slugOrId } = useParams<{ slugOrId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState<State>("verifying");
  const [ticket, setTicket] = useState<TicketPassData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const sessionId = searchParams.get("ticket_session_id");
    const rsvpId = searchParams.get("rsvp_id");
    if (!sessionId || !rsvpId) {
      setState("error");
      setErrorMsg("Missing session details.");
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-event-ticket-payment", {
          body: { sessionId, rsvpId },
        });
        if (error || !data?.success) {
          throw new Error(error?.message || data?.error || "Verification failed");
        }
        const { data: rsvpRow } = await supabase
          .from("event_rsvps")
          .select("id, ticket_code, user_name, status, payment_status, amount_paid_cents, events(*)")
          .eq("id", rsvpId)
          .maybeSingle();
        if (rsvpRow?.ticket_code && rsvpRow.events) {
          setTicket({
            id: rsvpRow.id,
            ticket_code: rsvpRow.ticket_code,
            user_name: rsvpRow.user_name,
            status: rsvpRow.status,
            payment_status: rsvpRow.payment_status,
            amount_paid_cents: rsvpRow.amount_paid_cents,
            event: rsvpRow.events as TicketPassData["event"],
          });
        }
        setState("success");
        toast({ title: "🎟️ Ticket confirmed!", description: "Check your email for your ticket." });
      } catch (e) {
        setState("error");
        setErrorMsg(e instanceof Error ? e.message : "Verification failed. Please contact us.");
      }
    })();
  }, [searchParams, toast]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead title="Ticket Confirmation — Replay Club" description="Your event ticket confirmation." />
      <div className="container max-w-xl mx-auto px-6 py-20 space-y-6">
        {state === "verifying" && (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">Verifying payment…</p>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
              <h1 className="font-display chrome-text text-2xl uppercase tracking-wider">You're in</h1>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
                Confirmation emailed. Save your ticket below.
              </p>
            </div>
            {ticket && (
              <div className="card-premium p-4">
                <TicketPass ticket={ticket} showWalletSave />
              </div>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="text-center space-y-4 py-12">
            <h1 className="font-display text-xl uppercase tracking-wider text-destructive">Verification failed</h1>
            <p className="text-xs text-muted-foreground font-body">{errorMsg}</p>
            <p className="text-[11px] text-muted-foreground font-body">
              If you were charged, please email replayclubrecords@gmail.com with your order details.
            </p>
            <button
              onClick={() => navigate(`/events/${slugOrId ?? ""}`)}
              className="btn-chrome inline-flex px-5 py-2 text-xs uppercase tracking-[0.2em]"
            >
              Back to event
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventConfirmation;