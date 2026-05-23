import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Package, ChevronDown, ChevronUp, Camera } from "lucide-react";
import { findPhotographerPackage } from "@/lib/bookingConstants";

interface Rental {
  id: string;
  customer_email: string;
  customer_name: string;
  items: string[];
  rental_days: number;
  amount_cents: number;
  payment_status: string;
  pickup_date: string | null;
  stripe_session_id: string | null;
  created_at: string;
}

const AdminRentalOrders = () => {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadRentals();
  }, []);

  const loadRentals = async () => {
    const { data, error } = await supabase
      .from("equipment_rentals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error loading rentals", description: error.message, variant: "destructive" });
    }
    if (data) setRentals(data as Rental[]);
  };

  const filtered = rentals.filter((r) => {
    const matchesSearch =
      !searchQuery ||
      r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(r.items) && r.items.some((i) => String(i).toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesStatus = statusFilter === "all" || r.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = rentals
    .filter((r) => r.payment_status === "paid")
    .reduce((sum, r) => sum + r.amount_cents, 0);

  const exportCsv = () => {
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Date", "Customer", "Email", "Items", "Days", "Amount", "Status", "Pickup"];
    const rows = filtered.map((r) => [
      new Date(r.created_at).toLocaleDateString(),
      r.customer_name,
      r.customer_email,
      Array.isArray(r.items) ? r.items.join("; ") : "",
      String(r.rental_days),
      `$${(r.amount_cents / 100).toFixed(2)}`,
      r.payment_status,
      r.pickup_date || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equipment-rentals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${rows.length} rentals downloaded.` });
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-green-500/10 text-green-400",
      pending: "bg-yellow-500/10 text-yellow-400",
      cancelled: "bg-destructive/10 text-destructive",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Orders", value: rentals.length },
          { label: "Revenue", value: `$${(totalRevenue / 100).toLocaleString()}` },
          { label: "Paid Orders", value: rentals.filter((r) => r.payment_status === "paid").length },
        ].map((stat) => (
          <div key={stat.label} className="chrome-surface rounded-lg p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-2 text-xs font-body text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-2 text-xs font-body text-foreground"
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      {/* Orders list */}
      <div className="space-y-2">
        {filtered.map((rental) => {
          const isExpanded = expandedId === rental.id;
          return (
            <div key={rental.id} className="card-premium overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : rental.id)}
                className="w-full p-3 text-left"
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-display text-sm font-semibold text-foreground truncate">
                        {rental.customer_name}
                      </span>
                      {findPhotographerPackage(rental.items) && (
                        <span
                          title={`Schedule photographer: ${findPhotographerPackage(rental.items)}`}
                          className="shrink-0 inline-flex items-center gap-1 text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
                        >
                          <Camera className="w-2.5 h-2.5" />
                          Photographer
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-body mt-0.5 truncate">
                      {Array.isArray(rental.items) ? rental.items.join(", ") : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className={`text-[10px] font-display uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadge(rental.payment_status)}`}>
                      {rental.payment_status}
                    </span>
                    <span className="font-display text-sm font-bold text-foreground">
                      ${(rental.amount_cents / 100).toFixed(2)}
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground font-body mt-1">
                  <span>{rental.rental_days} day{rental.rental_days > 1 ? "s" : ""}</span>
                  <span>{new Date(rental.created_at).toLocaleDateString()}</span>
                  {rental.pickup_date && <span>Pickup: {rental.pickup_date}</span>}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/30 px-3 pb-3 pt-2">
                  <div className="grid grid-cols-2 gap-2 text-xs font-body">
                    <div className="text-muted-foreground">Email</div>
                    <div className="text-foreground truncate">{rental.customer_email}</div>
                    <div className="text-muted-foreground">Items</div>
                    <div className="text-foreground">
                      {Array.isArray(rental.items) ? (
                        <ul className="list-disc list-inside">
                          {rental.items.map((item, i) => (
                            <li key={i}>{String(item)}</li>
                          ))}
                        </ul>
                      ) : "—"}
                    </div>
                    <div className="text-muted-foreground">Duration</div>
                    <div className="text-foreground">{rental.rental_days} day{rental.rental_days > 1 ? "s" : ""}</div>
                    <div className="text-muted-foreground">Pickup Date</div>
                    <div className="text-foreground">{rental.pickup_date || "Not specified"}</div>
                    <div className="text-muted-foreground">Return By</div>
                    <div className="text-foreground">
                      {rental.pickup_date
                        ? new Date(new Date(rental.pickup_date).getTime() + rental.rental_days * 86400000).toLocaleDateString()
                        : "—"}
                    </div>
                    <div className="text-muted-foreground">Order Date</div>
                    <div className="text-foreground">{new Date(rental.created_at).toLocaleString()}</div>
                    {rental.stripe_session_id && (
                      <>
                        <div className="text-muted-foreground">Stripe ID</div>
                        <div className="text-foreground font-mono text-[10px] truncate">{rental.stripe_session_id}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-body text-sm">
            <Package className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No rental orders {searchQuery || statusFilter !== "all" ? "match your filters" : "yet"}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRentalOrders;
