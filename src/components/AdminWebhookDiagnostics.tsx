import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, RefreshCcw, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

/**
 * User-safe diagnostics for Stripe webhook problems.
 * Surfaces the three failure modes that prevent bookings from being
 * marked as paid:
 *   1. Signature verification failures (e.g. live vs test key mismatch)
 *   2. Event processing errors (DB update failed, etc.)
 *   3. Bookings with a stripe_session_id but stuck in non-paid status
 *      despite a corresponding webhook event having been received.
 *
 * No raw payloads or secrets are shown — only sanitized reasons,
 * timestamps, and identifiers safe for an admin operator to read.
 */

interface SignatureFailure {
  id: string;
  created_at: string;
  error_message: string | null;
  attempts: number;
}

interface ProcessingFailure {
  id: string;
  event_id: string;
  event_type: string;
  error_message: string | null;
  attempts: number;
  created_at: string;
}

interface UnpaidBooking {
  id: string;
  customer_email: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  payment_status: string;
  stripe_session_id: string | null;
  created_at: string;
}

const AdminWebhookDiagnostics = () => {
  const [sigFails, setSigFails] = useState<SignatureFailure[]>([]);
  const [procFails, setProcFails] = useState<ProcessingFailure[]>([]);
  const [stuck, setStuck] = useState<UnpaidBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

      const [sigRes, procRes, stuckRes] = await Promise.all([
        (supabase as any)
          .from("webhook_events")
          .select("id,created_at,error_message,attempts")
          .eq("source", "stripe")
          .eq("event_type", "signature.verification_failed")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("webhook_events")
          .select("id,event_id,event_type,error_message,attempts,created_at")
          .eq("source", "stripe")
          .eq("status", "failed")
          .neq("event_type", "signature.verification_failed")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(20),
          (supabase as any)
            .from("bookings")
            .select("id,customer_email,room_title,booking_date,booking_time,payment_status,stripe_session_id,created_at")
            .not("stripe_session_id", "is", null)
            .not("payment_status", "in", "(paid,promo,cancelled,refunded)")
            .gte("created_at", cutoff)
            .order("created_at", { ascending: false })
            .limit(20),
      ]);

      if (sigRes.error) throw sigRes.error;
      if (procRes.error) throw procRes.error;
      if (stuckRes.error) throw stuckRes.error;

      setSigFails((sigRes.data ?? []) as SignatureFailure[]);
      setProcFails((procRes.data ?? []) as ProcessingFailure[]);
      setStuck((stuckRes.data ?? []) as UnpaidBooking[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const interpretSigError = (msg: string | null): string => {
    if (!msg) return "Unknown signature error";
    const m = msg.toLowerCase();
    if (m.includes("no signatures found")) {
      return "Secret mismatch — the webhook signing secret in the backend does not match the one Stripe is signing with. Most often caused by mixing test and live mode keys.";
    }
    if (m.includes("timestamp")) {
      return "Timestamp outside tolerance — the request is too old. Usually a clock skew or replayed event.";
    }
    if (m.includes("unable to extract")) {
      return "Malformed Stripe-Signature header.";
    }
    return msg;
  };

  const allClear =
    !loading && sigFails.length === 0 && procFails.length === 0 && stuck.length === 0;

  return (
    <Card className="border-border/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="w-4 h-4 text-primary" />
          Webhook Diagnostics
          <span className="text-xs font-normal text-muted-foreground">last 7 days</span>
        </CardTitle>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
          Refresh
        </button>
      </CardHeader>
      <CardContent className="space-y-6">
        {allClear && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-foreground">
              No webhook failures detected in the last 7 days. Bookings are flipping to paid normally.
            </p>
          </div>
        )}

        {/* Signature failures */}
        <section>
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Signature Verification Failures{" "}
            <Badge variant={sigFails.length > 0 ? "destructive" : "secondary"} className="ml-1">
              {sigFails.length}
            </Badge>
          </h3>
          {sigFails.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              None — Stripe-signed events are verifying correctly.
            </p>
          ) : (
            <div className="space-y-2">
              {sigFails.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-md border border-destructive/30 bg-destructive/5"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{interpretSigError(f.error_message)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(f.created_at), "MMM d, HH:mm:ss")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Processing failures */}
        <section>
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Event Processing Failures{" "}
            <Badge variant={procFails.length > 0 ? "destructive" : "secondary"} className="ml-1">
              {procFails.length}
            </Badge>
          </h3>
          {procFails.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              None — verified events are being processed without errors.
            </p>
          ) : (
            <div className="space-y-2">
              {procFails.map((f) => (
                <div key={f.id} className="p-3 rounded-md border border-destructive/30 bg-destructive/5">
                  <p className="text-xs font-display font-semibold text-foreground">{f.event_type}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{f.event_id}</p>
                  <p className="text-xs text-destructive mt-1">{f.error_message ?? "(no error message)"}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(f.created_at), "MMM d, HH:mm:ss")} · {f.attempts} attempt{f.attempts !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stuck bookings */}
        <section>
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Bookings Not Marked Paid{" "}
            <Badge variant={stuck.length > 0 ? "destructive" : "secondary"} className="ml-1">
              {stuck.length}
            </Badge>
          </h3>
          {stuck.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              None — all bookings with a checkout session are paid, cancelled, or refunded.
            </p>
          ) : (
            <div className="space-y-2">
              {stuck.map((b) => (
                <div key={b.id} className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-display font-semibold text-foreground truncate">
                      {b.room_title} · {b.booking_date} {b.booking_time}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {b.payment_status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{b.customer_email}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
                    session: {b.stripe_session_id}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Created {format(new Date(b.created_at), "MMM d, HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
};

export default AdminWebhookDiagnostics;