import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import { AlertTriangle, ShieldCheck, ShieldX, Clock, Ban } from "lucide-react";

interface PendingBooking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
  amount_cents: number;
  screening_status: string | null;
  screening_review_deadline: string | null;
  created_at: string;
}

interface IntakeRow {
  booking_id: string;
  purpose: string;
  attendee_count: number;
  attendee_names: string | null;
  referral_source: string | null;
  agreed_at: string;
}

const formatHoursLeft = (deadline: string | null): { label: string; tone: "ok" | "warn" | "stale" } => {
  if (!deadline) return { label: "—", tone: "ok" };
  const ms = new Date(deadline).getTime() - Date.now();
  const hrs = Math.round(ms / 3_600_000);
  if (ms <= 0) return { label: "OVERDUE", tone: "stale" };
  if (hrs <= 4) return { label: `${hrs}h left`, tone: "warn" };
  return { label: `${hrs}h left`, tone: "ok" };
};

export function AdminScreeningQueue() {
  const [rows, setRows] = useState<PendingBooking[]>([]);
  const [intakeByBooking, setIntakeByBooking] = useState<Record<string, IntakeRow>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});
  const [blockOnDecline, setBlockOnDecline] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, customer_name, customer_email, customer_phone, room_title, booking_date, booking_time, amount_cents, screening_status, screening_review_deadline, created_at")
      .eq("screening_status", "pending_review")
      .order("screening_review_deadline", { ascending: true })
      .limit(200);
    const list = (bookings ?? []) as PendingBooking[];
    setRows(list);

    if (list.length) {
      const ids = list.map((b) => b.id);
      const { data: intake } = await (supabase as any)
        .from("client_intake")
        .select("booking_id, purpose, attendee_count, attendee_names, referral_source, agreed_at")
        .in("booking_id", ids);
      const map: Record<string, IntakeRow> = {};
      for (const r of (intake ?? []) as IntakeRow[]) map[r.booking_id] = r;
      setIntakeByBooking(map);
    } else {
      setIntakeByBooking({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const now = Date.now();
    const overdue = rows.filter((r) => r.screening_review_deadline && new Date(r.screening_review_deadline).getTime() <= now).length;
    const soon = rows.filter((r) => {
      if (!r.screening_review_deadline) return false;
      const ms = new Date(r.screening_review_deadline).getTime() - now;
      return ms > 0 && ms <= 4 * 3600_000;
    }).length;
    return { total: rows.length, overdue, soon };
  }, [rows]);

  const approve = async (b: PendingBooking) => {
    if (!confirm(`Approve booking for ${b.customer_email}?\n\nThe address will be revealed in their confirmation email.`)) return;
    setActingId(b.id);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          screening_status: "approved",
          address_revealed: true,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", b.id);
      if (error) throw error;
      await (supabase as any).from("screening_review_log").insert({
        booking_id: b.id,
        action: "approve",
        reason: null,
      });
      await logAdminAction("approve", "booking_screening", b.id, { email: b.customer_email });

      // Send the full confirmation email (includes pickup landmark + escort instructions).
      try {
        await supabase.functions.invoke("send-booking-confirmation", {
          body: { bookingId: b.id },
        });
      } catch (emailErr) {
        console.error("Confirmation email failed", emailErr);
        toast({
          title: "Approved, but email failed",
          description: "Booking approved — please resend confirmation manually.",
          variant: "destructive",
        });
      }

      toast({ title: "Approved", description: "Confirmation email with pickup details sent." });
      load();
    } catch (e: any) {
      toast({ title: "Approve failed", description: e.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const decline = async (b: PendingBooking) => {
    const reason = (declineReason[b.id] ?? "").trim();
    if (!reason) {
      toast({ title: "Reason required", description: "Add a short internal note before declining.", variant: "destructive" });
      return;
    }
    if (!confirm(`Decline ${b.customer_email}?\n\nThis will void any payment hold and email an apology.`)) return;
    setActingId(b.id);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          screening_status: "declined",
          decline_reason: reason,
          payment_status: "cancelled",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", b.id);
      if (error) throw error;

      // Free the slot lock so others can book.
      await supabase
        .from("slot_locks")
        .delete()
        .eq("room_title", b.room_title)
        .eq("booking_date", b.booking_date)
        .eq("booking_time", b.booking_time);

      await (supabase as any).from("screening_review_log").insert({
        booking_id: b.id,
        action: "decline",
        reason,
      });
      await logAdminAction("reject", "booking_screening", b.id, { email: b.customer_email, reason });

      if (blockOnDecline[b.id]) {
        await (supabase as any).from("booking_blocklist").insert({
          email: b.customer_email,
          phone: b.customer_phone,
          full_name: b.customer_name,
          reason: "Declined screening",
          internal_note: reason,
        });
        await logAdminAction("create", "booking_blocklist", b.id, { email: b.customer_email });
      }

      // Apology email.
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            template: "booking-screening-declined",
            to: b.customer_email,
            data: {
              customerName: b.customer_name,
              roomTitle: b.room_title,
              bookingDate: b.booking_date,
              bookingTime: b.booking_time,
              reason,
              reapplyUrl: "https://www.replayclub.io",
            },
          },
        });
      } catch {/* non-fatal */}

      toast({ title: "Declined", description: "Apology email sent and slot freed." });
      load();
    } catch (e: any) {
      toast({ title: "Decline failed", description: e.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading screening queue…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          Screening Queue
          {counts.total > 0 && <Badge variant="secondary">{counts.total} pending</Badge>}
          {counts.soon > 0 && (
            <Badge variant="outline" className="gap-1">
              <Clock className="w-3 h-3" /> {counts.soon} due ≤4h
            </Badge>
          )}
          {counts.overdue > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> {counts.overdue} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No pending requests. 🎉</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Intake</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => {
                const intake = intakeByBooking[b.id];
                const deadline = formatHoursLeft(b.screening_review_deadline);
                return (
                  <TableRow key={b.id} className="align-top">
                    <TableCell className="text-xs">
                      <div className="font-medium">{b.customer_name}</div>
                      <div className="text-muted-foreground">{b.customer_email}</div>
                      <div className="text-muted-foreground">{b.customer_phone}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{b.room_title}</div>
                      <div className="text-muted-foreground">{b.booking_date} · {b.booking_time}</div>
                      <div className="text-muted-foreground">${(b.amount_cents / 100).toFixed(2)}</div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[260px]">
                      {intake ? (
                        <>
                          <div><strong>Purpose:</strong> {intake.purpose}</div>
                          <div><strong>Guests:</strong> {intake.attendee_count}</div>
                          {intake.attendee_names && (
                            <div className="text-muted-foreground">Names: {intake.attendee_names}</div>
                          )}
                          {intake.referral_source && (
                            <div className="text-muted-foreground">Referral: {intake.referral_source}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">No intake submitted</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge
                        variant={deadline.tone === "stale" ? "destructive" : deadline.tone === "warn" ? "outline" : "secondary"}
                      >
                        {deadline.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2 min-w-[200px]">
                        <Button
                          size="sm"
                          onClick={() => approve(b)}
                          disabled={actingId === b.id}
                          className="gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Textarea
                          placeholder="Decline reason (sent to customer)"
                          value={declineReason[b.id] ?? ""}
                          onChange={(e) => setDeclineReason((m) => ({ ...m, [b.id]: e.target.value }))}
                          className="h-16 text-xs"
                        />
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Input
                            type="checkbox"
                            checked={!!blockOnDecline[b.id]}
                            onChange={(e) => setBlockOnDecline((m) => ({ ...m, [b.id]: e.target.checked }))}
                            className="h-3 w-3"
                          />
                          <Ban className="w-3 h-3" /> Add to blocklist
                        </label>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => decline(b)}
                          disabled={actingId === b.id}
                          className="gap-1"
                        >
                          <ShieldX className="w-3.5 h-3.5" /> Decline
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}