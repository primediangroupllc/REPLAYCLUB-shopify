import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, Search, User as UserIcon } from "lucide-react";
import { format } from "date-fns";

interface CheckInRow {
  id: string;
  customer_name: string;
  customer_email: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
}

interface StaffProfile {
  id: string;
  display_name: string | null;
}

const AdminCheckInHistory = () => {
  const [rows, setRows] = useState<CheckInRow[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: bookings } = await supabase
        .from("bookings")
        .select(
          "id, customer_name, customer_email, room_title, booking_date, booking_time, checked_in_at, checked_in_by"
        )
        .not("checked_in_at", "is", null)
        .order("checked_in_at", { ascending: false })
        .limit(200);

      const list = (bookings as unknown as CheckInRow[]) || [];
      setRows(list);

      const staffIds = Array.from(
        new Set(list.map((r) => r.checked_in_by).filter(Boolean) as string[])
      );
      if (staffIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", staffIds);
        const map: Record<string, string> = {};
        (profiles as StaffProfile[] | null)?.forEach((p) => {
          map[p.id] = p.display_name || p.id.slice(0, 8);
        });
        setStaffMap(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.customer_name?.toLowerCase().includes(q) ||
      r.customer_email?.toLowerCase().includes(q) ||
        r.id?.toLowerCase().includes(q) ||
      r.room_title?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="chrome-surface rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h3 className="font-display text-xs uppercase tracking-wider text-foreground">
            Check-In History
          </h3>
          <span className="text-[10px] font-mono text-muted-foreground">
            {filtered.length}
          </span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, code..."
            className="w-full pl-7 pr-2 py-1.5 bg-card border border-border rounded-md text-xs font-body text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs font-body text-muted-foreground">
          Loading history...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs font-body text-muted-foreground">
          No check-ins recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-body">
            <thead className="bg-muted/20">
              <tr className="text-left">
                <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">ID</th>
                <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">Customer</th>
                <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">Session</th>
                <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">Checked In</th>
                <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">Verified By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/20 hover:bg-muted/10">
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    {r.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{r.customer_name}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {r.customer_email}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{r.room_title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.booking_date} • {r.booking_time}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {r.checked_in_at
                      ? format(new Date(r.checked_in_at), "MMM d, h:mm a")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <UserIcon className="w-3 h-3 text-muted-foreground" />
                      {r.checked_in_by
                        ? staffMap[r.checked_in_by] || r.checked_in_by.slice(0, 8)
                        : "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminCheckInHistory;
