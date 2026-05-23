import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { equipment as baseEquipment } from "@/components/EquipmentSection";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Wrench, Check, AlertTriangle, Package, Search, Plus, Trash2, Upload, Pencil,
} from "lucide-react";
import { useBookingTabsMeta } from "@/hooks/useBookingTabsMeta";
import { useServiceEquipmentRequirements } from "@/hooks/useServiceEquipmentRequirements";
import type { BookingTabType } from "@/lib/bookingTabImages";

interface EquipmentStatusRow {
  id: string;
  equipment_name: string;
  is_available: boolean;
  maintenance_note: string | null;
  unavailable_since: string | null;
  expected_available_at: string | null;
  updated_at: string;
}

interface CustomEquipmentRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  price_cents: number;
  price_label: string | null;
  sort_order: number;
  bookable: boolean;
}

interface BookingEquipmentEntry {
  equipment_name: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  room_title: string;
}

interface AdminEquipmentInventoryProps {
  bookings: {
    id: string;
    booking_date: string;
    booking_time: string;
    customer_name: string;
    room_title: string;
    equipment: unknown;
    payment_status: string;
  }[];
}

const AdminEquipmentInventory = ({ bookings }: AdminEquipmentInventoryProps) => {
  const [statusMap, setStatusMap] = useState<Map<string, EquipmentStatusRow>>(new Map());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: tabsMeta = [] } = useBookingTabsMeta();
  const { byBookingType } = useServiceEquipmentRequirements();

  // Toggle the (booking_type, equipment_name) mapping in
  // service_equipment_requirements. Persisted; realtime will fan out to all
  // open booking modals via useServiceEquipmentRequirements.
  const toggleServiceMapping = async (
    bookingType: BookingTabType,
    equipmentName: string,
    nextChecked: boolean,
  ) => {
    if (nextChecked) {
      const { error } = await (supabase as any)
        .from("service_equipment_requirements")
        .insert({ booking_type: bookingType, equipment_name: equipmentName });
      if (error && !`${error.message}`.includes("duplicate key")) {
        toast({ title: "Failed to link", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await (supabase as any)
        .from("service_equipment_requirements")
        .delete()
        .eq("booking_type", bookingType)
        .eq("equipment_name", equipmentName);
      if (error) {
        toast({ title: "Failed to unlink", description: error.message, variant: "destructive" });
        return;
      }
    }
    qc.invalidateQueries({ queryKey: ["service-equipment-requirements"] });
  };

  // Admin-managed custom equipment items
  const [customItems, setCustomItems] = useState<CustomEquipmentRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    category: "Other",
    price_label: "",
    price_cents: 0,
    sort_order: 0,
    bookable: true,
  });
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const loadCustom = async () => {
    const { data } = await supabase
      .from("custom_equipment_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (data) setCustomItems(data as CustomEquipmentRow[]);
  };

  const loadStatus = async () => {
    const { data } = await supabase.from("equipment_status").select("*");
    if (data) {
      const map = new Map<string, EquipmentStatusRow>();
      data.forEach((row: EquipmentStatusRow) => map.set(row.equipment_name, row));
      setStatusMap(map);
    }
  };

  useEffect(() => { loadStatus(); }, []);
  useEffect(() => { loadCustom(); }, []);

  const equipment = useMemo(() => {
    // Merge hardcoded base catalog + admin-managed custom items.
    // Custom items reuse the Package icon since icons aren't user-editable here.
    const customAsBase = customItems.map((c) => ({
      name: c.name,
      category: c.category,
      price: c.price_label || (c.price_cents ? `$${(c.price_cents / 100).toFixed(0)} / day` : "—"),
      priceCents: c.price_cents,
      icon: Package,
      description: c.description || "",
    }));
    return [...baseEquipment, ...customAsBase];
  }, [customItems]);

  const handleCreate = async () => {
    if (!newItem.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setCreating(true);
    let image_url: string | null = null;
    if (newImageFile) {
      const path = `equipment/${Date.now()}-${newImageFile.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("studio-assets")
        .upload(path, newImageFile, { upsert: false });
      if (upErr) {
        toast({ title: "Image upload failed", description: upErr.message, variant: "destructive" });
        setCreating(false);
        return;
      }
      const { data: pub } = supabase.storage.from("studio-assets").getPublicUrl(path);
      image_url = pub.publicUrl;
    }
    const { error } = await supabase.from("custom_equipment_items").insert({
      name: newItem.name.trim(),
      description: newItem.description.trim() || null,
      category: newItem.category.trim() || "Other",
      image_url,
      price_cents: Number(newItem.price_cents) || 0,
      price_label: newItem.price_label.trim() || null,
      sort_order: Number(newItem.sort_order) || 0,
      bookable: newItem.bookable,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Equipment item created" });
    setNewItem({ name: "", description: "", category: "Other", price_label: "", price_cents: 0, sort_order: 0, bookable: true });
    setNewImageFile(null);
    setShowCreate(false);
    await loadCustom();
  };

  const updateCustom = async (id: string, patch: Partial<CustomEquipmentRow>) => {
    const { error } = await supabase.from("custom_equipment_items").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else await loadCustom();
  };

  const deleteCustom = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("custom_equipment_items").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Deleted" });
      await loadCustom();
    }
  };

  // Build upcoming reservations per equipment from bookings
  const reservationsByEquipment = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const map: Record<string, BookingEquipmentEntry[]> = {};
    bookings.forEach((b) => {
      if (b.payment_status !== "paid" && b.payment_status !== "promo") return;
      if (b.booking_date < today) return;
      const items = Array.isArray(b.equipment) ? b.equipment : [];
      items.forEach((name: unknown) => {
        if (typeof name !== "string") return;
        if (!map[name]) map[name] = [];
        map[name].push({
          equipment_name: name,
          booking_date: b.booking_date,
          booking_time: b.booking_time,
          customer_name: b.customer_name,
          room_title: b.room_title,
        });
      });
    });
    // Sort each list by date
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.booking_date.localeCompare(b.booking_date))
    );
    return map;
  }, [bookings]);

  const toggleAvailability = async (name: string, currentlyAvailable: boolean) => {
    if (!currentlyAvailable) {
      // Making available again — just upsert
      await upsertStatus(name, true, null, null);
    } else {
      // Mark as unavailable — open the edit form
      setEditingItem(name);
      setMaintenanceNote("");
      setExpectedDate("");
    }
  };

  const upsertStatus = async (
    name: string,
    isAvailable: boolean,
    note: string | null,
    expectedAt: string | null
  ) => {
    setSaving(true);
    const existing = statusMap.get(name);
    const payload = {
      equipment_name: name,
      is_available: isAvailable,
      maintenance_note: note,
      unavailable_since: isAvailable ? null : (existing?.unavailable_since || new Date().toISOString()),
      expected_available_at: expectedAt,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("equipment_status")
        .update(payload)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("equipment_status").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isAvailable ? "Marked as available" : "Marked as unavailable" });
      setEditingItem(null);
      await loadStatus();
    }
    setSaving(false);
  };

  const handleSaveUnavailable = async (name: string) => {
    await upsertStatus(name, false, maintenanceNote || null, expectedDate || null);
  };

  const filtered = searchQuery
    ? equipment.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : equipment;

  const availableCount = equipment.filter((e) => {
    const status = statusMap.get(e.name);
    return !status || status.is_available;
  }).length;

  const reservedToday = equipment.filter((e) => {
    const today = new Date().toISOString().split("T")[0];
    return reservationsByEquipment[e.name]?.some((r) => r.booking_date === today);
  }).length;

  const outOfService = equipment.length - availableCount;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Available", value: availableCount, icon: Check, color: "text-green-400" },
          { label: "Reserved Today", value: reservedToday, icon: Package, color: "text-primary" },
          { label: "Out of Service", value: outOfService, icon: Wrench, color: "text-destructive" },
        ].map((stat) => (
          <div key={stat.label} className="chrome-surface rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
              <span className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </span>
            </div>
            <p className="font-display text-lg font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="chrome-surface rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">
              Custom Equipment
            </h3>
            <p className="text-[11px] text-muted-foreground font-body">
              Add new items to the inventory. Bookable items appear in the customer rental flow.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="chrome-btn font-display font-semibold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" /> {showCreate ? "Cancel" : "New Item"}
          </button>
        </div>

        {showCreate && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/30">
            <input
              type="text"
              placeholder="Name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body"
            />
            <input
              type="text"
              placeholder="Category (e.g. Microphones)"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body"
            />
            <textarea
              placeholder="Description"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              className="sm:col-span-2 bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body min-h-[60px]"
            />
            <input
              type="number"
              placeholder="Price (cents)"
              value={newItem.price_cents}
              onChange={(e) => setNewItem({ ...newItem, price_cents: Number(e.target.value) })}
              className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body"
            />
            <input
              type="text"
              placeholder="Price label (optional, e.g. $125 / day)"
              value={newItem.price_label}
              onChange={(e) => setNewItem({ ...newItem, price_label: e.target.value })}
              className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body"
            />
            <input
              type="number"
              placeholder="Display order"
              value={newItem.sort_order}
              onChange={(e) => setNewItem({ ...newItem, sort_order: Number(e.target.value) })}
              className="bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body"
            />
            <label className="flex items-center gap-2 text-xs font-body text-foreground bg-card border border-border rounded-md px-3 py-2">
              <input
                type="checkbox"
                checked={newItem.bookable}
                onChange={(e) => setNewItem({ ...newItem, bookable: e.target.checked })}
              />
              Bookable in rental flow
            </label>
            <label className="sm:col-span-2 flex items-center gap-2 text-xs font-body text-foreground bg-card border border-border rounded-md px-3 py-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{newImageFile ? newImageFile.name : "Upload image (optional)"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="sm:col-span-2 chrome-btn font-display font-semibold text-xs uppercase tracking-wider px-4 py-2 rounded-md disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Item"}
            </button>
          </div>
        )}

        {customItems.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/30">
            {customItems.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 bg-card border border-border/30 rounded-md p-2.5"
              >
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted/30 flex items-center justify-center">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-display font-bold text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground font-body truncate">
                    {c.category} · {c.price_label || `$${(c.price_cents / 100).toFixed(0)}`} · order {c.sort_order}
                  </p>
                </div>
                <button
                  onClick={() => updateCustom(c.id, { bookable: !c.bookable })}
                  className={cn(
                    "text-[9px] font-display uppercase tracking-wider px-2.5 py-1 rounded-md font-semibold",
                    c.bookable
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/30 text-muted-foreground"
                  )}
                  title="Toggle bookable"
                >
                  {c.bookable ? "Bookable" : "Display only"}
                </button>
                <button
                  onClick={() => deleteCustom(c.id, c.name)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                  aria-label={`Delete ${c.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search equipment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-card border border-border text-foreground rounded-md pl-9 pr-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Equipment list */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const status = statusMap.get(item.name);
          const isAvailable = !status || status.is_available;
          const reservations = reservationsByEquipment[item.name] || [];
          const isEditing = editingItem === item.name;
          const Icon = item.icon;

          return (
            <div key={item.name} className="chrome-surface rounded-lg overflow-hidden">
              {/* Main row */}
              <div className="flex items-center gap-3 p-4">
                <div className={cn(
                  "p-2 rounded-md",
                  isAvailable ? "bg-primary/5 text-primary" : "bg-destructive/10 text-destructive"
                )}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-semibold text-foreground">{item.name}</h4>
                    <span className="text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-card text-muted-foreground border border-border/30">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                    {item.price}
                    {reservations.length > 0 && (
                      <span className="ml-2 text-primary">
                        • {reservations.length} upcoming reservation{reservations.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>

                {/* Status badge + toggle */}
                <div className="flex items-center gap-2">
                  {!isAvailable && status?.maintenance_note && (
                    <span className="hidden sm:inline text-[10px] text-muted-foreground font-body max-w-[120px] truncate">
                      {status.maintenance_note}
                    </span>
                  )}
                  <button
                    onClick={() => toggleAvailability(item.name, isAvailable)}
                    className={cn(
                      "text-[9px] font-display uppercase tracking-wider px-3 py-1.5 rounded-md transition-all font-semibold",
                      isAvailable
                        ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    )}
                  >
                    {isAvailable ? "Available" : "Out of Service"}
                  </button>
                </div>
              </div>

              {/* Required by services — admin-editable mapping. Toggling these
                  blocks/unblocks the service in calendars site-wide via the
                  service_equipment_requirements table. */}
              <div className="border-t border-border/30 px-4 py-3 bg-card/30">
                <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Required by service
                </p>
                {tabsMeta.length === 0 ? (
                  <p className="text-[11px] font-body text-muted-foreground">Loading services…</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tabsMeta.map((m) => {
                      const checked = (byBookingType[m.booking_type] ?? []).includes(item.name);
                      return (
                        <button
                          key={m.booking_type}
                          type="button"
                          onClick={() => toggleServiceMapping(m.booking_type, item.name, !checked)}
                          className={cn(
                            "text-[10px] font-display uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors",
                            checked
                              ? "bg-primary/15 text-primary border-primary/40"
                              : "bg-muted/20 text-muted-foreground border-border/30 hover:border-border/60",
                          )}
                          title={
                            checked
                              ? `Click to unlink — ${m.title} will no longer require ${item.name}`
                              : `Click to link — ${m.title} will require ${item.name} (and become unavailable when it's rented out)`
                          }
                        >
                          {m.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Editing form for marking unavailable */}
              {isEditing && (
                <div className="border-t border-border/30 p-4 bg-card/50 space-y-3">
                  <p className="text-xs font-display font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                    Mark as Out of Service
                  </p>
                  <input
                    type="text"
                    placeholder="Reason (e.g., Sent for repair, Cable damaged)"
                    value={maintenanceNote}
                    onChange={(e) => setMaintenanceNote(e.target.value)}
                    className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex gap-3">
                    <input
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      placeholder="Expected return date"
                      className="flex-1 bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => setEditingItem(null)}
                      className="px-4 py-2 text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveUnavailable(item.name)}
                      disabled={saving}
                      className="px-4 py-2 bg-destructive text-destructive-foreground text-xs font-display font-semibold uppercase tracking-wider rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-all"
                    >
                      {saving ? "Saving..." : "Confirm"}
                    </button>
                  </div>
                </div>
              )}

              {/* Maintenance info when out of service */}
              {!isAvailable && !isEditing && status && (
                <div className="border-t border-border/30 px-4 py-3 bg-destructive/5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-body text-muted-foreground">
                  {status.maintenance_note && (
                    <span><strong className="text-foreground">Note:</strong> {status.maintenance_note}</span>
                  )}
                  {status.unavailable_since && (
                    <span>Since {format(new Date(status.unavailable_since), "MMM d, yyyy")}</span>
                  )}
                  {status.expected_available_at && (
                    <span className="text-primary">
                      Expected back {format(new Date(status.expected_available_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              )}

              {/* Upcoming reservations */}
              {reservations.length > 0 && (
                <details className="border-t border-border/30">
                  <summary className="px-4 py-2 text-[10px] font-display uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Upcoming Reservations ({reservations.length})
                  </summary>
                  <div className="px-4 pb-3 space-y-1.5">
                    {reservations.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] font-body text-muted-foreground">
                        <span>
                          <strong className="text-foreground">{r.customer_name}</strong> — {r.room_title}
                        </span>
                        <span>{format(new Date(r.booking_date + "T12:00:00"), "MMM d")} @ {r.booking_time}</span>
                      </div>
                    ))}
                    {reservations.length > 5 && (
                      <p className="text-[10px] text-muted-foreground">+{reservations.length - 5} more</p>
                    )}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminEquipmentInventory;
