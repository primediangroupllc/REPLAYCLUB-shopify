import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, User, Loader2, Calendar, Music, Gift, CreditCard, AlertCircle } from "lucide-react";
import { logAdminAction } from "@/lib/auditLog";

interface UserSnapshot {
  email: string;
  bookings: Array<{
    id: string;
    room_title: string;
    booking_date: string;
    booking_time: string;
    payment_status: string;
    amount_cents: number;
  }>;
  rentals: Array<{
    id: string;
    pickup_date: string | null;
    rental_days: number;
    amount_cents: number;
    payment_status: string;
  }>;
  mixes: Array<{ id: string; title: string; created_at: string; expires_at: string | null }>;
  giftCards: Array<{ id: string; code: string; balance_cents: number; amount_cents: number }>;
  loyalty: { booking_count: number } | null;
}

const AdminImpersonate = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<UserSnapshot | null>(null);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const lc = email.trim().toLowerCase();
    if (!lc) return;
    setLoading(true);
    setSnapshot(null);
    try {
      const [bookings, rentals, mixesByEmail, giftCards, loyalty] = await Promise.all([
        supabase
          .from("bookings")
          .select("id,room_title,booking_date,booking_time,payment_status,amount_cents")
          .ilike("customer_email", lc)
          .order("booking_date", { ascending: false })
          .limit(50),
        supabase
          .from("equipment_rentals")
          .select("id,pickup_date,rental_days,amount_cents,payment_status")
          .ilike("customer_email", lc)
          .order("created_at", { ascending: false })
          .limit(20),
        // Mixes are user-id scoped; lookup auth user via profiles join is restricted, so skip mixes for now
        Promise.resolve({ data: [] as any[] }),
        supabase
          .from("gift_cards")
          .select("id,code,balance_cents,amount_cents")
          .or(`purchaser_email.ilike.${lc},recipient_email.ilike.${lc}`)
          .limit(20),
        supabase.rpc("get_loyalty_info", { user_email: lc }),
      ]);

      await logAdminAction("read", "user_snapshot", lc, { reason: "support_lookup" });

      setSnapshot({
        email: lc,
        bookings: (bookings.data as any) || [],
        rentals: (rentals.data as any) || [],
        mixes: (mixesByEmail.data as any) || [],
        giftCards: (giftCards.data as any) || [],
        loyalty: (loyalty.data as any) || null,
      });
    } catch (err: any) {
      toast.error(err?.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        <h2 className="font-display text-base font-bold text-foreground uppercase tracking-wider">
          User Lookup
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Read-only support view. All lookups are logged to the audit trail.
      </p>

      <form onSubmit={lookup} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border/40 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-display uppercase tracking-wider disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Lookup"}
        </button>
      </form>

      {snapshot && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat icon={Calendar} label="Bookings" value={snapshot.bookings.length} />
            <Stat icon={CreditCard} label="Rentals" value={snapshot.rentals.length} />
            <Stat icon={Gift} label="Gift Cards" value={snapshot.giftCards.length} />
            <Stat
              icon={Music}
              label="Loyalty"
              value={snapshot.loyalty?.booking_count ?? 0}
            />
          </div>

          <Section title="Recent Bookings">
            {snapshot.bookings.length === 0 ? (
              <Empty />
            ) : (
              snapshot.bookings.slice(0, 10).map((b) => (
                <Row
                  key={b.id}
                  primary={`${b.room_title} · ${format(new Date(b.booking_date), "MMM d, yyyy")} ${b.booking_time}`}
                  secondary={`${b.id.slice(0, 8)} · $${(b.amount_cents / 100).toFixed(2)}`}
                  tag={b.payment_status}
                />
              ))
            )}
          </Section>

          <Section title="Equipment Rentals">
            {snapshot.rentals.length === 0 ? (
              <Empty />
            ) : (
              snapshot.rentals.map((r) => (
                <Row
                  key={r.id}
                  primary={`Pickup ${r.pickup_date ? format(new Date(r.pickup_date), "MMM d, yyyy") : "—"} · ${r.rental_days}d`}
                  secondary={`$${(r.amount_cents / 100).toFixed(2)}`}
                  tag={r.payment_status}
                />
              ))
            )}
          </Section>

          <Section title="Gift Cards">
            {snapshot.giftCards.length === 0 ? (
              <Empty />
            ) : (
              snapshot.giftCards.map((g) => (
                <Row
                  key={g.id}
                  primary={g.code}
                  secondary={`Balance $${(g.balance_cents / 100).toFixed(2)} / $${(g.amount_cents / 100).toFixed(2)}`}
                />
              ))
            )}
          </Section>

          <div className="flex items-start gap-2 p-3 rounded-lg border border-border/30 bg-card/30 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              This is a read-only snapshot. To act on a user's behalf (refund, reschedule, etc.), use the
              dedicated tabs (Bookings, Rentals, Gift Cards) — those operations are also audit-logged.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div className="chrome-surface rounded-lg p-3 space-y-1.5">
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-muted-foreground" />
      <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
    <p className="font-display text-base font-bold text-foreground">{value}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {title}
    </h3>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Row = ({
  primary,
  secondary,
  tag,
}: {
  primary: string;
  secondary: string;
  tag?: string;
}) => (
  <div className="flex items-center justify-between gap-3 p-2.5 rounded-md border border-border/30 bg-card/50">
    <div className="flex-1 min-w-0">
      <p className="text-xs font-display text-foreground truncate">{primary}</p>
      <p className="text-[10px] text-muted-foreground truncate">{secondary}</p>
    </div>
    {tag && (
      <span className="px-2 py-0.5 rounded-full text-[9px] font-display uppercase tracking-wider bg-muted/30 text-muted-foreground flex-shrink-0">
        {tag}
      </span>
    )}
  </div>
);

const Empty = () => <p className="text-xs text-muted-foreground italic px-2">No records.</p>;

export default AdminImpersonate;