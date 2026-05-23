import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Trash2, Users, DollarSign, Edit3, X, Search, Download, Check, UserCheck, Camera, Bell, MapPin, Upload, UserPlus, Copy, Link as LinkIcon, Ban, Activity, LogIn, Ticket, Sparkles, ExternalLink, ArrowUp, ArrowDown, Archive, ArchiveRestore } from "lucide-react";
import AdminEventExtras from "./AdminEventExtras";
import { EVENT_CARD_STYLE_OPTIONS, type EventCardStyle } from "@/components/EventCard";
import { logAdminAction } from "@/lib/auditLog";

interface EventRow {
  id: string;
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
  show_price: boolean;
  cover_image_url: string | null;
  status: string;
  is_public_teaser: boolean;
  event_type: string;
  card_style: EventCardStyle;
  refund_policy: string | null;
  slug: string | null;
  sort_order: number;
  archived_at: string | null;
}

const blank = {
  title: "",
  description: "",
  event_date: "",
  start_time: "",
  end_time: "",
  room_title: "",
  location: "",
  capacity: 30,
  price_cents: 0,
  is_free: false,
  show_price: true,
  cover_image_url: "",
  status: "draft",
  is_public_teaser: true,
  event_type: "listening_session",
    card_style: "glass_chrome" as EventCardStyle,
    refund_policy: "",
    sort_order: 0,
};

interface RsvpRow {
  id: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  status: string;
  payment_status: string;
  amount_paid_cents: number;
  ticket_code: string | null;
  checked_in_at: string | null;
  created_at: string;
  waitlist_position: number | null;
}

interface HostRow {
  id: string;
  event_id: string;
  host_name: string;
  host_email: string | null;
  organization: string | null;
  token: string;
  revoked: boolean;
  last_accessed_at: string | null;
  created_at: string;
}

const AdminEventsManager = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [editing, setEditing] = useState<typeof blank | (typeof blank & { id?: string }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rsvpsByEvent, setRsvpsByEvent] = useState<Record<string, { confirmed: number; waitlist: number }>>({});
  const [notifyByEvent, setNotifyByEvent] = useState<Record<string, { total: number; pending: number }>>({});
  const [notifySending, setNotifySending] = useState<Record<string, boolean>>({});
  const [attendeesEvent, setAttendeesEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<RsvpRow[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Hosts
  const [hostsEvent, setHostsEvent] = useState<EventRow | null>(null);
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [newHostName, setNewHostName] = useState("");
  const [newHostEmail, setNewHostEmail] = useState("");
  const [newHostOrg, setNewHostOrg] = useState("");
  const [hostsLoading, setHostsLoading] = useState(false);
  const [hostCounts, setHostCounts] = useState<Record<string, number>>({});
  const [activityLog, setActivityLog] = useState<Array<{ id: string; host_id: string; action: string; guest_name: string | null; guest_email: string | null; created_at: string }>>([]);
  const [extrasFor, setExtrasFor] = useState<EventRow | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [salesByHost, setSalesByHost] = useState<Record<string, { tickets_sold: number; confirmed_tickets: number; revenue_cents: number; last_sale_at: string | null }>>({});

  const load = async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("event_date", { ascending: true });
    setEvents((data as EventRow[]) || []);

    if (data && data.length) {
      const counts: Record<string, { confirmed: number; waitlist: number }> = {};
      await Promise.all(
        (data as EventRow[]).map(async (e) => {
          const { data: a } = await supabase.rpc("get_event_attendance", { p_event_id: e.id });
          const x = (a as { confirmed_count?: number; waitlist_count?: number } | null) || {};
          counts[e.id] = { confirmed: x.confirmed_count || 0, waitlist: x.waitlist_count || 0 };
        }),
      );
      setRsvpsByEvent(counts);

      const { data: signups } = await supabase
        .from("event_notify_signups")
        .select("event_id, notified_at");
      const ncounts: Record<string, { total: number; pending: number }> = {};
      (signups || []).forEach((s) => {
        const key = s.event_id;
        if (!ncounts[key]) ncounts[key] = { total: 0, pending: 0 };
        ncounts[key].total += 1;
        if (!s.notified_at) ncounts[key].pending += 1;
      });
      setNotifyByEvent(ncounts);

      // host counts
      const { data: hostRows } = await (supabase as any)
        .from("event_hosts")
        .select("event_id, revoked");
      const hc: Record<string, number> = {};
      (hostRows || []).forEach((h: { event_id: string; revoked: boolean }) => {
        if (!h.revoked) hc[h.event_id] = (hc[h.event_id] || 0) + 1;
      });
      setHostCounts(hc);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const uploadCover = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("event-covers").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("event-covers").getPublicUrl(path);
      setEditing({ ...editing, cover_image_url: pub.publicUrl });
      toast({ title: "Cover uploaded" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title || !editing.event_date || !editing.start_time) {
      toast({ title: "Missing fields", description: "Title, date and start time are required", variant: "destructive" });
      return;
    }
    const payload = {
      title: editing.title,
      description: editing.description || null,
      event_date: editing.event_date,
      start_time: editing.start_time,
      end_time: null,
      room_title: editing.room_title || null,
      location: editing.location || null,
      capacity: Number(editing.capacity) || 30,
      price_cents: editing.is_free ? 0 : Number(editing.price_cents) || 0,
      is_free: editing.is_free,
      show_price: editing.show_price,
      cover_image_url: editing.cover_image_url || null,
      status: editing.status,
      is_public_teaser: editing.is_public_teaser,
      event_type: editing.event_type,
      card_style: editing.card_style || "glass_chrome",
      refund_policy: editing.refund_policy?.trim() ? editing.refund_policy.trim() : null,
      sort_order: Number((editing as any).sort_order) || 0,
    };

    if ("id" in editing && editing.id) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("events").insert(payload);
      if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
    }
    toast({ title: "Saved" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this event? RSVPs will also be removed.")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Deleted" });
    logAdminAction("delete", "event", id);
    load();
  };

  const moveEvent = async (event: EventRow, delta: number) => {
    // Find neighbour with adjacent sort_order in current sorted order.
    const idx = events.findIndex((e) => e.id === event.id);
    const target = idx + delta;
    if (target < 0 || target >= events.length) return;
    const other = events[target];
    const a = event.sort_order ?? 0;
    const b = other.sort_order ?? 0;
    // Swap sort_order values; if equal, bump to keep a stable swap.
    const [na, nb] = a === b ? (delta < 0 ? [b - 1, a] : [b + 1, a]) : [b, a];
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("events").update({ sort_order: na }).eq("id", event.id),
      supabase.from("events").update({ sort_order: nb }).eq("id", other.id),
    ]);
    if (e1 || e2) {
      toast({ title: "Reorder failed", description: (e1 || e2)?.message, variant: "destructive" });
      return;
    }
    load();
  };

  const toggleArchive = async (event: EventRow) => {
    const next = event.archived_at ? null : new Date().toISOString();
    const { error } = await supabase.from("events").update({ archived_at: next }).eq("id", event.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    toast({ title: next ? "Archived" : "Unarchived" });
    load();
  };

  const notifySubscribers = async (event: EventRow) => {
    const counts = notifyByEvent[event.id] || { total: 0, pending: 0 };
    if (counts.pending === 0) {
      toast({ title: "No pending subscribers", description: "Everyone has already been notified." });
      return;
    }
    if (event.status !== "published") {
      toast({ title: "Publish first", description: "Set the event to Published before notifying subscribers.", variant: "destructive" });
      return;
    }
    if (!confirm(`Send "event is live" email to ${counts.pending} subscriber${counts.pending === 1 ? "" : "s"}?`)) return;
    setNotifySending({ ...notifySending, [event.id]: true });
    try {
      const { data: pending, error } = await supabase
        .from("event_notify_signups")
        .select("id, email")
        .eq("event_id", event.id)
        .is("notified_at", null);
      if (error) throw error;

      const eventUrl = `${window.location.origin}/events/${event.id}`;
      let sent = 0;
      let failed = 0;
      for (const sub of pending || []) {
        const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "event-live-notification",
            recipientEmail: sub.email,
            idempotencyKey: `event-live-${event.id}-${sub.id}`,
            templateData: {
              eventTitle: event.title,
              eventDate: event.event_date,
              eventTime: event.start_time,
              roomTitle: event.room_title || "",
              eventUrl,
            },
          },
        });
        if (sendErr) {
          failed += 1;
        } else {
          sent += 1;
          await supabase
            .from("event_notify_signups")
            .update({ notified_at: new Date().toISOString() })
            .eq("id", sub.id);
        }
      }
      toast({
        title: failed === 0 ? `✓ Notified ${sent} subscriber${sent === 1 ? "" : "s"}` : `Sent ${sent}, ${failed} failed`,
        variant: failed === 0 ? undefined : "destructive",
      });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Notify failed", description: msg, variant: "destructive" });
    } finally {
      setNotifySending({ ...notifySending, [event.id]: false });
    }
  };

  const openAttendees = async (event: EventRow) => {
    setAttendeesEvent(event);
    setAttendeeSearch("");
    setAttendeesLoading(true);
    const { data, error } = await supabase
      .from("event_rsvps")
      .select("id, user_name, user_email, user_phone, status, payment_status, amount_paid_cents, ticket_code, checked_in_at, created_at, waitlist_position")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });
    setAttendeesLoading(false);
    if (error) {
      toast({ title: "Failed to load attendees", description: error.message, variant: "destructive" });
      return;
    }
    setAttendees((data as RsvpRow[]) || []);
  };

  const toggleCheckIn = async (rsvp: RsvpRow) => {
    const nextCheckedIn = !rsvp.checked_in_at;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("event_rsvps")
      .update({
        checked_in_at: nextCheckedIn ? new Date().toISOString() : null,
        checked_in_by: nextCheckedIn ? user?.id || null : null,
      })
      .eq("id", rsvp.id);
    if (error) return toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    setAttendees((prev) =>
      prev.map((r) =>
        r.id === rsvp.id ? { ...r, checked_in_at: nextCheckedIn ? new Date().toISOString() : null } : r,
      ),
    );
    toast({ title: nextCheckedIn ? "✓ Checked in" : "Check-in removed" });
  };

  const exportCsv = () => {
    if (!attendeesEvent) return;
    const headers = ["Name", "Email", "Phone", "Status", "Payment", "Amount Paid (USD)", "Ticket Code", "Checked In At", "RSVP'd At"];
    const escape = (v: string | null) => `"${(v || "").replace(/"/g, '""')}"`;
    const rows = attendees.map((r) =>
      [
        escape(r.user_name),
        escape(r.user_email),
        escape(r.user_phone),
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
    const slug = attendeesEvent.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `${slug || "event"}-${attendeesEvent.event_date}-attendees.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAttendees = useMemo(() => {
    const q = attendeeSearch.trim().toLowerCase();
    if (!q) return attendees;
    return attendees.filter(
      (r) =>
        r.user_name.toLowerCase().includes(q) ||
        r.user_email.toLowerCase().includes(q) ||
        (r.user_phone || "").toLowerCase().includes(q) ||
        (r.ticket_code || "").toLowerCase().includes(q),
    );
  }, [attendees, attendeeSearch]);

  const checkedInCount = attendees.filter((r) => r.checked_in_at && r.status === "confirmed").length;
  const confirmedCount = attendees.filter((r) => r.status === "confirmed").length;

  // Hosts
  const openHosts = async (event: EventRow) => {
    setHostsEvent(event);
    setNewHostName("");
    setNewHostEmail("");
    setNewHostOrg("");
    setHostsLoading(true);
    setActivityLoading(true);
    const [hostsRes, logRes, salesRes] = await Promise.all([
      (supabase as any).from("event_hosts").select("*").eq("event_id", event.id).order("created_at", { ascending: true }),
      (supabase as any).from("host_activity_log").select("id, host_id, action, guest_name, guest_email, created_at").eq("event_id", event.id).order("created_at", { ascending: false }).limit(100),
      (supabase as any).rpc("get_host_sales_stats", { p_event_id: event.id }),
    ]);
    setHostsLoading(false);
    setActivityLoading(false);
    if (hostsRes.error) {
      toast({ title: "Failed to load hosts", description: hostsRes.error.message, variant: "destructive" });
      return;
    }
    setHosts((hostsRes.data as HostRow[]) || []);
    setActivityLog(logRes.data || []);
    const map: Record<string, { tickets_sold: number; confirmed_tickets: number; revenue_cents: number; last_sale_at: string | null }> = {};
    (salesRes.data || []).forEach((s: any) => {
      map[s.host_id] = {
        tickets_sold: s.tickets_sold || 0,
        confirmed_tickets: s.confirmed_tickets || 0,
        revenue_cents: s.revenue_cents || 0,
        last_sale_at: s.last_sale_at,
      };
    });
    setSalesByHost(map);
  };

  const addHost = async () => {
    if (!hostsEvent || !newHostName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const { data, error } = await (supabase as any)
      .from("event_hosts")
      .insert({
        event_id: hostsEvent.id,
        host_name: newHostName.trim(),
        host_email: newHostEmail.trim() || null,
        organization: newHostOrg.trim() || null,
      })
      .select()
      .single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setHosts([...hosts, data as HostRow]);
    setNewHostName("");
    setNewHostEmail("");
    setNewHostOrg("");
    setHostCounts({ ...hostCounts, [hostsEvent.id]: (hostCounts[hostsEvent.id] || 0) + 1 });
    toast({ title: "✓ Host added — copy their magic link" });
  };

  const toggleRevoke = async (host: HostRow) => {
    const { error } = await (supabase as any)
      .from("event_hosts")
      .update({ revoked: !host.revoked })
      .eq("id", host.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setHosts(hosts.map((h) => (h.id === host.id ? { ...h, revoked: !h.revoked } : h)));
    if (hostsEvent) {
      const delta = host.revoked ? 1 : -1;
      setHostCounts({ ...hostCounts, [hostsEvent.id]: Math.max(0, (hostCounts[hostsEvent.id] || 0) + delta) });
    }
    toast({ title: host.revoked ? "Access restored" : "Access revoked" });
  };

  const removeHost = async (host: HostRow) => {
    if (!confirm(`Remove ${host.host_name}? Their magic link will stop working.`)) return;
    const { error } = await (supabase as any).from("event_hosts").delete().eq("id", host.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setHosts(hosts.filter((h) => h.id !== host.id));
    if (hostsEvent && !host.revoked) {
      setHostCounts({ ...hostCounts, [hostsEvent.id]: Math.max(0, (hostCounts[hostsEvent.id] || 0) - 1) });
    }
    toast({ title: "Host removed" });
    logAdminAction("delete", "event_host", host.id, { host_name: host.host_name });
  };

  const copyHostLink = async (host: HostRow) => {
    const url = `${window.location.origin}/host/${host.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "✓ Dashboard link copied" });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  };

  const copySalesLink = async (host: HostRow) => {
    const url = `${window.location.origin}/sell/${host.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "✓ Sales link copied" });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="card-premium p-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Events</h3>
          <p className="text-[11px] text-muted-foreground font-body">Listening sessions, open decks, showcases.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/events/homepage"
            className="chrome-btn-outline font-display font-semibold text-xs uppercase tracking-wider px-3 py-2 rounded-md inline-flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Homepage
          </a>
          <a
            href="/admin/scan"
            className="chrome-btn-outline font-display font-semibold text-xs uppercase tracking-wider px-3 py-2 rounded-md inline-flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" /> Scan
          </a>
          <button
            onClick={() => setEditing({ ...blank })}
            className="chrome-btn font-display font-semibold text-xs uppercase tracking-wider px-3 py-2 rounded-md inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>

      {events.length === 0 && (
        <div className="card-premium p-6 text-center text-muted-foreground text-sm font-body">No events yet.</div>
      )}

      {events.map((e) => {
        const counts = rsvpsByEvent[e.id] || { confirmed: 0, waitlist: 0 };
        const hostCount = hostCounts[e.id] || 0;
        const isArchived = !!e.archived_at;
        return (
          <div key={e.id} className={`card-premium p-4 space-y-2 ${isArchived ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-display text-sm font-bold text-foreground">{e.title}</h4>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${e.status === "published" ? "bg-emerald-900/40 text-emerald-300" : e.status === "cancelled" ? "bg-red-900/40 text-red-300" : "bg-card border border-border text-muted-foreground"}`}>
                    {e.status}
                  </span>
                  {isArchived && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                      archived
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-body">
                  {e.event_date} · {e.start_time}{e.location ? ` · ${e.location}` : e.room_title ? ` · ${e.room_title}` : ""}
                </p>
                {e.location && e.room_title && (
                  <p className="text-[11px] text-muted-foreground font-body inline-flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{e.location}
                  </p>
                )}
                <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{counts.confirmed}/{e.capacity}</span>
                  {counts.waitlist > 0 && <span>+{counts.waitlist} waitlist</span>}
                  <span className="inline-flex items-center gap-1"><DollarSign className="w-3 h-3" />{e.is_free || e.price_cents === 0 ? "Free" : `$${(e.price_cents / 100).toFixed(2)}`}</span>
                  {(notifyByEvent[e.id]?.total || 0) > 0 && (
                    <span className="inline-flex items-center gap-1" title="Notify-me signups (pending / total)">
                      <Bell className="w-3 h-3" />{notifyByEvent[e.id].pending}/{notifyByEvent[e.id].total}
                    </span>
                  )}
                  {hostCount > 0 && (
                    <span className="inline-flex items-center gap-1" title="Active hosts">
                      <UserPlus className="w-3 h-3" />{hostCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <div className="flex gap-1">
                  <button onClick={() => moveEvent(e, -1)} className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveEvent(e, 1)} className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
                {(notifyByEvent[e.id]?.pending || 0) > 0 && (
                  <button
                    onClick={() => notifySubscribers(e)}
                    disabled={!!notifySending[e.id] || e.status !== "published"}
                    className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                    title={e.status === "published" ? `Notify ${notifyByEvent[e.id].pending} subscriber(s) it's live` : "Publish event before notifying"}
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => openHosts(e)} className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title="Manage hosts (collab partners)"><UserPlus className="w-3.5 h-3.5" /></button>
                <button onClick={() => openAttendees(e)} className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title="Attendees & check-in"><UserCheck className="w-3.5 h-3.5" /></button>
                <button onClick={() => setExtrasFor(e)} className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title="Tiers, lineup & gallery"><Sparkles className="w-3.5 h-3.5" /></button>
                <a href={`/events/${e.slug || e.id}`} target="_blank" rel="noreferrer" className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground inline-flex" title="View landing page"><ExternalLink className="w-3.5 h-3.5" /></a>
                <button onClick={() => setEditing({ ...blank, ...e, description: e.description || "", end_time: e.end_time || "", room_title: e.room_title || "", location: e.location || "", cover_image_url: e.cover_image_url || "", is_free: e.is_free || e.price_cents === 0, show_price: e.show_price !== false, card_style: (e.card_style as EventCardStyle) || "glass_chrome", refund_policy: e.refund_policy || "" })} className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => toggleArchive(e)} className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title={isArchived ? "Unarchive" : "Archive"}>
                  {isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => remove(e.id)} className="p-2 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-red-400" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        );
      })}

      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="card-premium p-6 max-w-lg w-full space-y-3 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider">{("id" in editing && editing.id) ? "Edit" : "New"} Event</h3>
              <button onClick={() => setEditing(null)}><X className="w-4 h-4" /></button>
            </div>
            <input className="w-full bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="Title" value={editing.title} onChange={(ev) => setEditing({ ...editing, title: ev.target.value })} />
            <textarea className="w-full bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="Description" rows={3} value={editing.description} onChange={(ev) => setEditing({ ...editing, description: ev.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="bg-card border border-border rounded-md px-3 py-2 text-xs" value={editing.event_date} onChange={(ev) => setEditing({ ...editing, event_date: ev.target.value })} />
              <input className="bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="Time (e.g. 8:00 PM)" value={editing.start_time} onChange={(ev) => setEditing({ ...editing, start_time: ev.target.value })} />
            </div>
            <input className="w-full bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="Room (optional)" value={editing.room_title} onChange={(ev) => setEditing({ ...editing, room_title: ev.target.value })} />
            <input className="w-full bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="Custom venue/address (optional, for off-site events)" value={editing.location} onChange={(ev) => setEditing({ ...editing, location: ev.target.value })} />
            <div className="grid grid-cols-2 gap-2 items-end">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Passes
                <input type="number" min={1} className="w-full mt-1 bg-card border border-border rounded-md px-3 py-2 text-xs" value={editing.capacity} onChange={(ev) => setEditing({ ...editing, capacity: Number(ev.target.value) })} />
              </label>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Price (USD)
                <input type="number" min={0} step="0.01" disabled={editing.is_free} className="w-full mt-1 bg-card border border-border rounded-md px-3 py-2 text-xs disabled:opacity-40" value={(editing.price_cents / 100).toFixed(2)} onChange={(ev) => setEditing({ ...editing, price_cents: Math.round(Number(ev.target.value) * 100) })} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.is_free} onChange={(ev) => setEditing({ ...editing, is_free: ev.target.checked, price_cents: ev.target.checked ? 0 : editing.price_cents })} />
              Free event (no ticket charge)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.show_price} onChange={(ev) => setEditing({ ...editing, show_price: ev.target.checked })} />
              Show price on event card (turn off to hide until tickets go live)
            </label>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">Cover Image</label>
              {editing.cover_image_url && (
                <div className="relative">
                  <img src={editing.cover_image_url} alt="Cover preview" className="w-full h-32 object-cover rounded-md border border-border" />
                  <button onClick={() => setEditing({ ...editing, cover_image_url: "" })} className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-white"><X className="w-3 h-3" /></button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="chrome-btn-outline px-3 py-2 rounded-md text-[11px] font-display uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />{uploading ? "Uploading…" : "Upload"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(ev) => ev.target.files?.[0] && uploadCover(ev.target.files[0])} />
                </label>
                <input className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="…or paste image URL" value={editing.cover_image_url} onChange={(ev) => setEditing({ ...editing, cover_image_url: ev.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select className="bg-card border border-border rounded-md px-3 py-2 text-xs" value={editing.status} onChange={(ev) => setEditing({ ...editing, status: ev.target.value })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
              <select className="bg-card border border-border rounded-md px-3 py-2 text-xs" value={editing.event_type} onChange={(ev) => setEditing({ ...editing, event_type: ev.target.value })}>
                <option value="listening_session">Listening Session</option>
                <option value="open_decks">Open Decks</option>
                <option value="showcase">Showcase</option>
                <option value="other">Other</option>
              </select>
            </div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">Card Style
              <select
                className="w-full mt-1 bg-card border border-border rounded-md px-3 py-2 text-xs"
                value={editing.card_style || "glass_chrome"}
                onChange={(ev) => setEditing({ ...editing, card_style: ev.target.value as EventCardStyle })}
              >
                {EVENT_CARD_STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">Refund / Cancellation Policy
              <textarea
                className="w-full mt-1 bg-card border border-border rounded-md px-3 py-2 text-xs"
                placeholder="e.g. Full refund if cancelled 48h before event. No refunds within 24h."
                rows={3}
                value={editing.refund_policy || ""}
                onChange={(ev) => setEditing({ ...editing, refund_policy: ev.target.value })}
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block normal-case tracking-normal">Shown to ticket buyers on the event page. Leave blank to hide.</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.is_public_teaser} onChange={(ev) => setEditing({ ...editing, is_public_teaser: ev.target.checked })} />
              Show as public teaser (title + date visible to non-members)
            </label>
            <button onClick={save} className="chrome-btn w-full py-2 rounded-md text-xs font-display uppercase tracking-wider font-semibold">Save</button>
          </div>
        </div>
      )}

      {hostsEvent && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setHostsEvent(null)}>
          <div className="card-premium p-5 max-w-xl w-full space-y-3 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider truncate">Hosts · {hostsEvent.title}</h3>
                <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                  Collab partners get a magic link to view the guest list, ticket analytics, and check guests in.
                </p>
              </div>
              <button onClick={() => setHostsEvent(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-2 p-3 rounded-md border border-border/50 bg-card/50">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Add Host</p>
              <input className="w-full bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="Host name *" value={newHostName} onChange={(ev) => setNewHostName(ev.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className="bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="Email (optional)" value={newHostEmail} onChange={(ev) => setNewHostEmail(ev.target.value)} />
                <input className="bg-card border border-border rounded-md px-3 py-2 text-xs" placeholder="Organization" value={newHostOrg} onChange={(ev) => setNewHostOrg(ev.target.value)} />
              </div>
              <button onClick={addHost} className="chrome-btn w-full py-2 rounded-md text-xs font-display uppercase tracking-wider font-semibold inline-flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add & Generate Link
              </button>
            </div>

            <div className="max-h-[45vh] overflow-y-auto space-y-1.5">
              {hostsLoading && <div className="text-center text-xs text-muted-foreground py-6">Loading…</div>}
              {!hostsLoading && hosts.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">No hosts yet.</div>
              )}
              {hosts.map((h) => (
                <div key={h.id} className={`p-2.5 rounded-md bg-card border border-border/40 space-y-1.5 ${h.revoked ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-display font-semibold text-foreground truncate">
                        {h.host_name}
                        {h.revoked && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-red-400">revoked</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {h.organization || ""}{h.organization && h.host_email ? " · " : ""}{h.host_email || ""}
                      </p>
                      {h.last_accessed_at && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">Last accessed {new Date(h.last_accessed_at).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => copySalesLink(h)} className="p-1.5 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title="Copy SALES link (/sell/...)"><DollarSign className="w-3 h-3" /></button>
                      <button onClick={() => copyHostLink(h)} className="p-1.5 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title="Copy DASHBOARD link (/host/...)"><Copy className="w-3 h-3" /></button>
                      <button onClick={() => toggleRevoke(h)} className="p-1.5 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-foreground" title={h.revoked ? "Restore access" : "Revoke access"}><Ban className="w-3 h-3" /></button>
                      <button onClick={() => removeHost(h)} className="p-1.5 rounded-md bg-card border border-border/30 text-muted-foreground hover:text-red-400" title="Remove"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  {(() => {
                    const s = salesByHost[h.id];
                    if (!s || s.tickets_sold === 0) return (
                      <div className="text-[10px] text-muted-foreground italic">No sales yet via /sell link</div>
                    );
                    return (
                      <div className="flex items-center gap-3 text-[10px] flex-wrap pt-1 border-t border-border/30">
                        <span className="inline-flex items-center gap-1 text-emerald-300"><Ticket className="w-2.5 h-2.5" />{s.confirmed_tickets} sold</span>
                        <span className="inline-flex items-center gap-1 text-foreground font-mono">${(s.revenue_cents / 100).toFixed(2)}</span>
                        {s.last_sale_at && <span className="text-muted-foreground">last: {new Date(s.last_sale_at).toLocaleDateString()}</span>}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate">
                    <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">/sell/{h.token.slice(0, 12)}… · /host/{h.token.slice(0, 12)}…</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Activity Log
                <span className="font-mono opacity-60">({activityLog.length})</span>
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {activityLoading && <div className="text-center text-[11px] text-muted-foreground py-3">Loading…</div>}
                {!activityLoading && activityLog.length === 0 && (
                  <div className="text-center text-[11px] text-muted-foreground py-3">No host activity yet.</div>
                )}
                {activityLog.map((a) => {
                  const host = hosts.find((h) => h.id === a.host_id);
                  const hostName = host?.host_name || "Unknown host";
                  const isAccess = a.action === "dashboard_access";
                  const isCheckIn = a.action === "check_in";
                  return (
                    <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-card/50 border border-border/30 text-[11px]">
                      <div className={`shrink-0 mt-0.5 ${isAccess ? "text-blue-400" : isCheckIn ? "text-emerald-400" : "text-amber-400"}`}>
                        {isAccess ? <LogIn className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate">
                          <span className="font-display font-semibold">{hostName}</span>
                          {isAccess && " opened dashboard"}
                          {isCheckIn && (
                            <> checked in <span className="text-emerald-300">{a.guest_name}</span></>
                          )}
                          {a.action === "check_out" && (
                            <> reverted check-in for <span className="text-amber-300">{a.guest_name}</span></>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {attendeesEvent && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setAttendeesEvent(null)}>
          <div className="card-premium p-5 max-w-2xl w-full space-y-3 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider truncate">{attendeesEvent.title}</h3>
                <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                  {attendeesEvent.event_date} · {attendeesEvent.start_time} · Checked in {checkedInCount}/{confirmedCount}
                </p>
              </div>
              <button onClick={() => setAttendeesEvent(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  className="w-full bg-card border border-border rounded-md pl-8 pr-3 py-2 text-xs"
                  placeholder="Search name, email, or ticket code…"
                  value={attendeeSearch}
                  onChange={(ev) => setAttendeeSearch(ev.target.value)}
                />
              </div>
              <button
                onClick={exportCsv}
                disabled={attendees.length === 0}
                className="chrome-btn-outline px-3 py-2 rounded-md text-[11px] font-display uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto space-y-1.5 pr-1">
              {attendeesLoading && <div className="text-center text-xs text-muted-foreground py-6">Loading…</div>}
              {!attendeesLoading && filteredAttendees.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">No matching attendees.</div>
              )}
              {filteredAttendees.map((r) => {
                const isConfirmed = r.status === "confirmed";
                const isCheckedIn = !!r.checked_in_at;
                return (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-md bg-card border border-border/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-display font-semibold text-foreground truncate">{r.user_name}</p>
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          r.status === "confirmed" ? "bg-emerald-900/40 text-emerald-300" :
                          r.status === "waitlist" ? "bg-amber-900/40 text-amber-300" :
                          r.status === "pending_payment" ? "bg-blue-900/40 text-blue-300" :
                          "bg-card border border-border text-muted-foreground"
                        }`}>{r.status}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{r.user_email}</p>
                      {r.user_phone && (
                        <p className="text-[10px] text-muted-foreground truncate">📞 {r.user_phone}</p>
                      )}
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
                        title={isCheckedIn ? "Undo check-in" : "Mark as checked in"}
                      >
                        <Check className="w-3 h-3" />
                        {isCheckedIn ? "In" : "Check in"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {extrasFor && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setExtrasFor(null)}>
          <div className="card-premium p-6 max-w-2xl w-full space-y-3 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Extras — {extrasFor.title}</h3>
              <button onClick={() => setExtrasFor(null)}><X className="w-4 h-4" /></button>
            </div>
            <AdminEventExtras eventId={extrasFor.id} eventSlug={extrasFor.slug} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEventsManager;
