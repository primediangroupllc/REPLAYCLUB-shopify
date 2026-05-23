import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users, DollarSign, Search, Check, Download, ShieldAlert, Ticket } from "lucide-react";

interface HostEvent {
  host_id: string;
  host_name: string;
  organization: string | null;
  event_id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  room_title: string | null;
  location: string | null;
  capacity: number;
  price_cents: number;
  is_free: boolean;
  cover_image_url: string | null;
  status: string;
  event_type: string;
  refund_policy: string | null;
}

interface RsvpRow {
  id: string;
  user_name: string;
  user_email: string;
  status: string;
  payment_status: string;
  amount_paid_cents: number;
  ticket_code: string | null;
  checked_in_at: string | null;
  created_at: string;
  waitlist_position: number | null;
}

const HostDashboard = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<HostEvent | null>(null);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      // Log dashboard access (throttled server-side to once per 5 min)
      (supabase as any).rpc("log_host_access", { p_token: token }).then(() => {});
      const { data: ev, error: e1 } = await (supabase as any).rpc("get_host_event", { p_token: token });
      if (e1 || !ev || ev.length === 0) {
        setError("This host link is invalid or has been revoked.");
        setLoading(false);
        return;
      }
      setEvent(ev[0] as HostEvent);

      const { data: rs, error: e2 } = await (supabase as any).rpc("get_host_rsvps", { p_token: token });
      if (e2) {
        setError(e2.message);
        setLoading(false);
        return;
      }
      setRsvps((rs as RsvpRow[]) || []);
      setLoading(false);
    })();
  }, [token]);

  const stats = useMemo(() => {
    const confirmed = rsvps.filter((r) => r.status === "confirmed");
    const waitlist = rsvps.filter((r) => r.status === "waitlist").length;
    const checkedIn = confirmed.filter((r) => r.checked_in_at).length;
    const revenue = rsvps.reduce((sum, r) => sum + (r.amount_paid_cents || 0), 0);
    return {
      confirmed: confirmed.length,
      waitlist,
      checkedIn,
      revenue,
      capacityPct: event ? Math.round((confirmed.length / Math.max(1, event.capacity)) * 100) : 0,
    };
  }, [rsvps, event]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rsvps;
    return rsvps.filter(
      (r) =>
        r.user_name.toLowerCase().includes(q) ||
        r.user_email.toLowerCase().includes(q) ||
        (r.ticket_code || "").toLowerCase().includes(q),
    );
  }, [rsvps, search]);

  const toggleCheckIn = async (rsvp: RsvpRow) => {
    if (!token) return;
    const next = !rsvp.checked_in_at;
    const { error: e } = await (supabase as any).rpc("host_check_in", {
      p_token: token,
      p_rsvp_id: rsvp.id,
      p_check_in: next,
    });
    if (e) return toast({ title: "Check-in failed", description: e.message, variant: "destructive" });
    setRsvps((prev) =>
      prev.map((r) =>
        r.id === rsvp.id ? { ...r, checked_in_at: next ? new Date().toISOString() : null } : r,
      ),
    );
    toast({ title: next ? "✓ Checked in" : "Check-in removed" });
  };

  const exportCsv = () => {
    if (!event) return;
    const headers = ["Name", "Email", "Status", "Payment", "Amount Paid (USD)", "Ticket Code", "Checked In At", "RSVP'd At"];
    const escape = (v: string | null) => `"${(v || "").replace(/"/g, '""')}"`;
    const rows = rsvps.map((r) =>
      [
        escape(r.user_name),
        escape(r.user_email),
        escape(r.status),
        escape(r.payment_status),
        ((r.amount_paid_cents || 0) / 100).toFixed(2),
        escape(r.ticket_code),
        escape(r.checked_in_at),
        escape(r.created_at),
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `${slug || "event"}-${event.event_date}-attendees.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-premium p-8 max-w-md text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-red-400" />
          <h1 className="font-display text-lg font-semibold chrome-text">Access denied</h1>
          <p className="text-sm text-muted-foreground font-body">{error || "Host link not found."}</p>
          <Link to="/" className="chrome-btn-outline inline-block px-4 py-2 rounded-md text-xs font-display uppercase tracking-wider">Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Host Dashboard</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold chrome-text leading-tight">{event.title}</h1>
          <p className="text-xs text-muted-foreground font-body">
            Welcome, <span className="text-foreground font-semibold">{event.host_name}</span>
            {event.organization ? ` · ${event.organization}` : ""}
          </p>
        </header>

        {event.cover_image_url && (
          <img src={event.cover_image_url} alt="" className="w-full h-40 sm:h-56 object-cover rounded-lg border border-border" />
        )}

        <section className="card-premium p-4 sm:p-5 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground font-body">
            <div className="inline-flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {event.event_date} · {event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}</div>
            {(event.location || event.room_title) && (
              <div className="inline-flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {event.location || event.room_title}</div>
            )}
            <div className="inline-flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" /> {event.is_free || event.price_cents === 0 ? "Free" : `$${(event.price_cents / 100).toFixed(2)}`}</div>
            <div className="inline-flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Capacity {event.capacity}</div>
          </div>
          {event.description && <p className="text-xs text-muted-foreground font-body pt-2 border-t border-border/30">{event.description}</p>}
          {event.refund_policy && (
            <div className="pt-3 mt-2 border-t border-border/30">
              <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-mono mb-1.5">Refund Policy</p>
              <p className="text-xs text-muted-foreground font-body leading-relaxed whitespace-pre-wrap">{event.refund_policy}</p>
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Confirmed" value={`${stats.confirmed}/${event.capacity}`} sub={`${stats.capacityPct}% sold`} />
          <Stat label="Checked In" value={`${stats.checkedIn}`} sub={`of ${stats.confirmed}`} />
          <Stat label="Waitlist" value={`${stats.waitlist}`} sub="people" />
          <Stat label="Revenue" value={`$${(stats.revenue / 100).toFixed(0)}`} sub={`${rsvps.length} tickets`} />
        </section>

        <section className="card-premium p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider inline-flex items-center gap-2">
              <Ticket className="w-4 h-4" /> Guest List
            </h2>
            <button
              onClick={exportCsv}
              disabled={rsvps.length === 0}
              className="chrome-btn-outline px-3 py-1.5 rounded-md text-[11px] font-display uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full bg-card border border-border rounded-md pl-8 pr-3 py-2 text-xs"
              placeholder="Search name, email, or ticket code…"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
            />
          </div>

          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6">
                {rsvps.length === 0 ? "No RSVPs yet." : "No matching guests."}
              </div>
            )}
            {filtered.map((r) => {
              const isConfirmed = r.status === "confirmed";
              const isCheckedIn = !!r.checked_in_at;
              return (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-md bg-card border border-border/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-display font-semibold text-foreground truncate">{r.user_name}</p>
                      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        r.status === "confirmed" ? "bg-emerald-900/40 text-emerald-300" :
                        r.status === "waitlist" ? "bg-amber-900/40 text-amber-300" :
                        r.status === "pending_payment" ? "bg-blue-900/40 text-blue-300" :
                        "bg-card border border-border text-muted-foreground"
                      }`}>{r.status}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{r.user_email}</p>
                    {r.ticket_code && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">🎟️ {r.ticket_code}</p>
                    )}
                  </div>
                  {isConfirmed && (
                    <button
                      onClick={() => toggleCheckIn(r)}
                      className={`p-2 rounded-md border text-[10px] font-display uppercase tracking-wider inline-flex items-center gap-1 shrink-0 transition-colors ${
                        isCheckedIn
                          ? "bg-emerald-900/40 border-emerald-700/50 text-emerald-300"
                          : "bg-card border-border/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      {isCheckedIn ? "In" : "Check in"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-[10px] text-muted-foreground text-center font-body">
          Magic-link access · Replay Club hosts only · Do not share this URL publicly.
        </p>
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="card-premium p-3 sm:p-4 text-center">
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="font-display text-xl sm:text-2xl font-bold chrome-text mt-1">{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

export default HostDashboard;
