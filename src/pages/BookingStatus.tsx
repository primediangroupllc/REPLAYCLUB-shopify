import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SeoHead from "@/components/SeoHead";
import { PICKUP_LANDMARK, PICKUP_INSTRUCTIONS } from "@/lib/studioLocation";
import { Clock, ShieldCheck, ShieldX, MapPin, Loader2 } from "lucide-react";

interface StatusRow {
  booking_id: string;
  customer_name: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  screening_status: string | null;
  address_revealed: boolean;
  decline_reason: string | null;
  review_deadline: string | null;
  created_at: string;
}

const STATUS_COPY: Record<string, { label: string; tone: "secondary" | "default" | "destructive"; description: string }> = {
  pending_review: {
    label: "Pending review",
    tone: "secondary",
    description: "Your request is in our review queue. We aim to respond within 24 hours. You'll get an email the moment a decision is made.",
  },
  approved: {
    label: "Approved",
    tone: "default",
    description: "You're confirmed. Pickup details and escort instructions are below and in your confirmation email.",
  },
  declined: {
    label: "Declined",
    tone: "destructive",
    description: "Unfortunately we couldn't accommodate this request.",
  },
  auto_declined: {
    label: "Auto-declined",
    tone: "destructive",
    description: "Our review window elapsed without an action. Any payment hold has been released.",
  },
  withdrawn: {
    label: "Withdrawn",
    tone: "secondary",
    description: "This request was withdrawn.",
  },
};

const BookingStatus = () => {
  const { token } = useParams<{ token: string }>();
  const [row, setRow] = useState<StatusRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing status token");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await (supabase as any).rpc("get_booking_status_by_token", { p_token: token });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        setError("We couldn't find a booking for this link. It may have expired.");
      } else {
        const r = Array.isArray(data) ? data[0] : data;
        setRow(r as StatusRow);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <>
      <SeoHead
        title="Booking status — Replay Club"
        description="Check the status of your Replay Club booking request."
      />
      <main className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Your booking request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              )}
              {error && !loading && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {row && !loading && (() => {
                const status = row.screening_status ?? "pending_review";
                const copy = STATUS_COPY[status] ?? STATUS_COPY.pending_review;
                const showAddress = row.address_revealed && (status === "approved");
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant={copy.tone}>{copy.label}</Badge>
                      {status === "pending_review" && row.review_deadline && (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          decision by {new Date(row.review_deadline).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{copy.description}</p>

                    <div className="rounded-md border border-border/50 p-4 space-y-1 text-sm">
                      <div><span className="text-muted-foreground">Name: </span>{row.customer_name}</div>
                      <div><span className="text-muted-foreground">Service: </span>{row.room_title}</div>
                      <div><span className="text-muted-foreground">Date: </span>{row.booking_date}</div>
                      <div><span className="text-muted-foreground">Time: </span>{row.booking_time}</div>
                    </div>

                    {row.decline_reason && (status === "declined" || status === "auto_declined") && (
                      <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive">
                        <strong>Note from the studio:</strong> {row.decline_reason}
                      </div>
                    )}

                    {showAddress && (
                      <div className="rounded-md bg-primary/5 border border-primary/30 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <MapPin className="w-4 h-4" /> Pickup point
                        </div>
                        <p className="text-sm">{PICKUP_LANDMARK.formatted}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a href={PICKUP_LANDMARK.directionsUrl} target="_blank" rel="noopener noreferrer">
                              Get directions
                            </a>
                          </Button>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          {PICKUP_INSTRUCTIONS.map((line) => (<li key={line}>{line}</li>))}
                        </ul>
                      </div>
                    )}

                    {(status === "declined" || status === "auto_declined") && (
                      <Button asChild className="w-full">
                        <Link to="/">Submit a new request</Link>
                      </Button>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default BookingStatus;