import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { DollarSign, Calendar, Users, TrendingUp, Clock, Lock, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  VISION_MODE_MONTHLY_TARGET_CENTS,
  VISION_MODE_ROOM_SPLIT,
  VISION_MODE_TOTAL_BOOKINGS,
  VISION_MODE_UNIQUE_CUSTOMERS,
  visionMonthlyBookingsSeries,
  visionMonthlyRevenueSeries,
} from "@/lib/visionMode";

interface Booking {
  id: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  payment_status: string;
  amount_cents: number;
  customer_name: string;
  customer_email: string;
  created_at: string;
}

interface AdminAnalyticsProps {
  bookings: Booking[];
}

const PIE_COLORS = [
  "hsl(0 0% 85%)", "hsl(0 0% 65%)", "hsl(0 0% 50%)", "hsl(0 0% 38%)", "hsl(0 0% 28%)",
];

const tooltipStyle = {
  background: "hsl(0 0% 7%)",
  border: "1px solid hsl(0 0% 16%)",
  borderRadius: "8px",
  fontSize: 12,
  color: "hsl(0 0% 95%)",
};

const axisProps = {
  tick: { fill: "hsl(0 0% 55%)", fontSize: 10 },
  axisLine: { stroke: "hsl(0 0% 16%)" },
};

const AdminAnalytics = ({ bookings }: AdminAnalyticsProps) => {
  // ---- Vision Mode (display-only simulated revenue) ---------------------
  const [visionMode, setVisionMode] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("vision_mode_enabled")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setVisionMode(!!(data as any).vision_mode_enabled);
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Lock-conversion + failure metrics (last 14 days) -----------------
  const [lockMetrics, setLockMetrics] = useState<{
    activeHolds: number;
    expiredHoldsLast24h: number;
    convertedHoldsLast24h: number;
    conversionPct: number;
    failuresLast7d: number;
  } | null>(null);
  const [failureCategories, setFailureCategories] = useState<Array<{ category: string; count: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [active, recentLocks, recentBookings, failures] = await Promise.all([
        supabase.from("slot_locks").select("id", { count: "exact", head: true }).gt("expires_at", nowIso),
        supabase.from("slot_locks").select("id, stripe_session_id, booking_id, created_at").gte("created_at", since24),
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .gte("created_at", since24).eq("payment_status", "paid"),
        (supabase as any).from("failure_reports").select("id", { count: "exact", head: true })
          .gte("created_at", since7d),
      ]);
      if (cancelled) return;
      const totalLocks = recentLocks.data?.length || 0;
      const converted = recentBookings.count || 0;
      const expired = Math.max(totalLocks - converted, 0);
      const conv = totalLocks > 0 ? Math.round((converted / totalLocks) * 100) : 0;
      setLockMetrics({
        activeHolds: active.count || 0,
        expiredHoldsLast24h: expired,
        convertedHoldsLast24h: converted,
        conversionPct: conv,
        failuresLast7d: failures.count || 0,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // Failure category breakdown (last 30 days)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from("failure_reports")
        .select("category")
        .gte("created_at", since)
        .limit(1000);
      if (cancelled || !data) return;
      const counts: Record<string, number> = {};
      (data as Array<{ category: string | null }>).forEach((r) => {
        const k = r.category || "other";
        counts[k] = (counts[k] || 0) + 1;
      });
      setFailureCategories(
        Object.entries(counts)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
      );
    })();
    return () => { cancelled = true; };
  }, []);

  const paidBookings = bookings.filter((b) => b.payment_status === "paid" || b.payment_status === "promo");
  const realTotalRevenue = bookings.filter((b) => b.payment_status === "paid").reduce((s, b) => s + b.amount_cents, 0);
  const realTotalBookings = bookings.length;
  const realUniqueCustomers = new Set(bookings.map((b) => b.customer_email.toLowerCase())).size;

  // Vision-aware values used in display only.
  const totalRevenue = visionMode ? VISION_MODE_MONTHLY_TARGET_CENTS : realTotalRevenue;
  const totalBookings = visionMode ? VISION_MODE_TOTAL_BOOKINGS : realTotalBookings;
  const uniqueCustomers = visionMode ? VISION_MODE_UNIQUE_CUSTOMERS : realUniqueCustomers;
  const avgBookingCents = visionMode
    ? Math.round(VISION_MODE_MONTHLY_TARGET_CENTS / VISION_MODE_TOTAL_BOOKINGS)
    : (paidBookings.length ? Math.round(realTotalRevenue / paidBookings.length) : 0);
  const simTag = (label: string) => (visionMode ? `${label} (sim)` : label);

  const now = new Date();

  // Revenue by month (last 12 months)
  const realMonthlyRevenue = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const month = d.toLocaleString("default", { month: "short" });
      const m = d.getMonth();
      const y = d.getFullYear();
      const revenue = bookings
        .filter((b) => b.payment_status === "paid" && new Date(b.booking_date).getMonth() === m && new Date(b.booking_date).getFullYear() === y)
        .reduce((s, b) => s + b.amount_cents, 0);
      return { month: `${month} '${String(y).slice(2)}`, revenue: revenue / 100 };
    }), [bookings]);
  const monthlyRevenue = visionMode ? visionMonthlyRevenueSeries(now) : realMonthlyRevenue;

  // Bookings by month
  const realMonthlyBookings = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const month = d.toLocaleString("default", { month: "short" });
      const m = d.getMonth();
      const y = d.getFullYear();
      const count = bookings.filter((b) => {
        const bd = new Date(b.booking_date);
        return bd.getMonth() === m && bd.getFullYear() === y;
      }).length;
      return { month: `${month} '${String(y).slice(2)}`, count };
    }), [bookings]);
  const monthlyBookings = visionMode ? visionMonthlyBookingsSeries(now) : realMonthlyBookings;

  // Bookings by room (pie)
  const realRoomData = useMemo(() => {
    const counts: Record<string, number> = {};
    paidBookings.forEach((b) => { counts[b.room_title] = (counts[b.room_title] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [bookings]);
  const roomData = visionMode
    ? VISION_MODE_ROOM_SPLIT.map((r) => ({ name: r.name, value: r.bookings }))
    : realRoomData;

  // Peak booking hours
  const hourData = useMemo(() => {
    const hours: Record<string, number> = {};
    bookings.forEach((b) => {
      const timeStr = b.booking_time;
      hours[timeStr] = (hours[timeStr] || 0) + 1;
    });
    return Object.entries(hours)
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [bookings]);

  // Peak booking days of week
  const dayOfWeekData = useMemo(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const counts = Array(7).fill(0);
    bookings.forEach((b) => {
      const d = new Date(b.booking_date + "T12:00:00").getDay();
      counts[d]++;
    });
    return days.map((name, i) => ({ name: name.slice(0, 3), count: counts[i] }));
  }, [bookings]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    bookings.forEach((b) => {
      const key = b.customer_email.toLowerCase();
      if (!map[key]) map[key] = { name: b.customer_name, count: 0, revenue: 0 };
      map[key].count++;
      if (b.payment_status === "paid") map[key].revenue += b.amount_cents;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Vision Mode banner — non-dismissible while toggle is on */}
      {visionMode && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 flex items-center gap-3"
        >
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs sm:text-sm font-display font-semibold text-amber-300">
            Vision Mode active — displaying simulated revenue, not real bookings.
          </p>
        </div>
      )}

      {/* Lock conversion / failure metrics */}
      {lockMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active Holds", value: lockMetrics.activeHolds, icon: Lock },
            { label: "Conv. (24h)", value: `${lockMetrics.conversionPct}%`, icon: TrendingUp },
            { label: "Abandoned (24h)", value: lockMetrics.expiredHoldsLast24h, icon: Clock },
            { label: "Failures (7d)", value: lockMetrics.failuresLast7d, icon: AlertTriangle },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="chrome-surface rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center gap-1.5">
                <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">{stat.label}</span>
              </div>
              <p className="font-display text-lg font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: simTag("Total Revenue"), value: `$${(totalRevenue / 100).toLocaleString()}`, icon: DollarSign },
          { label: simTag("Total Bookings"), value: totalBookings, icon: Calendar },
          { label: simTag("Unique Customers"), value: uniqueCustomers, icon: Users },
          { label: simTag("Avg / Booking"), value: avgBookingCents ? `$${Math.round(avgBookingCents / 100)}` : "$0", icon: TrendingUp },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`chrome-surface rounded-lg p-4 space-y-2 ${visionMode ? "ring-1 ring-amber-500/30" : ""}`}
          >
            <div className="flex items-center gap-1.5">
              <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">{stat.label}</span>
            </div>
            <p className="font-display text-lg font-bold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Revenue Trend (12 months) */}
      <div className="chrome-surface rounded-lg p-4 space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          {simTag("Revenue Trend (12 mo)")}
          {visionMode && <span className="text-[9px] font-body text-amber-400 normal-case tracking-normal">Simulated</span>}
        </h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${value}`, "Revenue"]} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(0 0% 85%)" strokeWidth={2} dot={{ fill: "hsl(0 0% 85%)", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bookings by month + By room */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="chrome-surface rounded-lg p-4 space-y-3">
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            {simTag("Bookings / Month")}
            {visionMode && <span className="text-[9px] font-body text-amber-400 normal-case tracking-normal">Simulated</span>}
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBookings}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(0 0% 85%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chrome-surface rounded-lg p-4 space-y-3">
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            {simTag("Most Popular Rooms")}
            {visionMode && <span className="text-[9px] font-body text-amber-400 normal-case tracking-normal">Simulated</span>}
          </h3>
          <div className="h-48">
            {roomData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roomData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {roomData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm font-body">No data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Peak times */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="chrome-surface rounded-lg p-4 space-y-3">
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Peak Booking Times
          </h3>
          <div className="space-y-2">
            {hourData.length > 0 ? hourData.map((h, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-display text-foreground w-20">{h.time}</span>
                <div className="flex-1 h-5 bg-card rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(h.count / hourData[0].count) * 100}%`,
                      background: "linear-gradient(90deg, hsl(0 0% 45%), hsl(0 0% 75%))",
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-display w-6 text-right">{h.count}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground font-body text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        <div className="chrome-surface rounded-lg p-4 space-y-3">
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Busiest Days</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(0 0% 65%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="chrome-surface rounded-lg p-4 space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Top Customers</h3>
        <div className="space-y-2">
          {topCustomers.map((c, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-card rounded-md border border-border/30">
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-bold text-muted-foreground w-5">#{i + 1}</span>
                <div>
                  <p className="font-display text-xs font-semibold text-foreground">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground font-body">{c.count} booking{c.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <span className="font-display text-sm font-bold text-foreground">${(c.revenue / 100).toLocaleString()}</span>
            </div>
          ))}
          {topCustomers.length === 0 && (
            <p className="text-center text-muted-foreground text-sm font-body py-6">No data yet.</p>
          )}
        </div>
      </div>

      {/* Failure categories (last 30 days) */}
      <div className="chrome-surface rounded-lg p-4 space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Failure Categories (30d)
        </h3>
        {failureCategories.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm font-body py-6">No failures recorded.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={failureCategories} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                <XAxis type="number" {...axisProps} allowDecimals={false} />
                <YAxis type="category" dataKey="category" {...axisProps} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(0 80% 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
