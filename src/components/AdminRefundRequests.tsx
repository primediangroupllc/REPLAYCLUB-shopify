import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import { Clock, AlertTriangle } from "lucide-react";

interface Row {
  id: string;
  booking_id: string | null;
  customer_email: string;
  customer_name: string | null;
  reason: string;
  amount_cents: number;
  status: string;
  hours_before_session: number | null;
  created_at: string;
}

export function AdminRefundRequests() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("refund_requests")
      .select("*").order("created_at", { ascending: false }).limit(100);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (row: Row, approve: boolean) => {
    if (approve && !confirm(`Approve and refund $${(row.amount_cents/100).toFixed(2)} to ${row.customer_email}?`)) return;
    const { error } = await (supabase as any).from("refund_requests").update({
      status: approve ? "approved" : "denied",
      reviewed_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    await logAdminAction(approve ? "approve" : "reject", "refund_request", row.id, { amount_cents: row.amount_cents });
    toast({ title: approve ? "Approved — process refund in Stripe" : "Denied" });
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const now = Date.now();
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const stalePending = rows.filter(
    (r) => r.status === "pending" && now - new Date(r.created_at).getTime() > 48 * 3600_000
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          Refund Requests
          {pendingCount > 0 && (
            <Badge variant="secondary">{pendingCount} pending</Badge>
          )}
          {stalePending > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> {stalePending} over 48h
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Hrs before</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const ageHours = (now - new Date(r.created_at).getTime()) / 3600_000;
              const isStale = r.status === "pending" && ageHours > 48;
              const isWarning = r.status === "pending" && ageHours > 24;
              return (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.customer_name}<br/>{r.customer_email}</TableCell>
                <TableCell>${(r.amount_cents / 100).toFixed(2)}</TableCell>
                <TableCell className="max-w-xs text-xs">{r.reason}</TableCell>
                <TableCell>{r.hours_before_session?.toFixed(1) ?? "—"}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 text-xs ${isStale ? "text-destructive font-semibold" : isWarning ? "text-yellow-500" : "text-muted-foreground"}`}>
                    <Clock className="w-3 h-3" />
                    {ageHours < 1 ? `${Math.round(ageHours * 60)}m` : ageHours < 24 ? `${Math.round(ageHours)}h` : `${Math.round(ageHours / 24)}d`}
                  </span>
                </TableCell>
                <TableCell><Badge variant={r.status === "processed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                <TableCell>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(r, true)}>Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => decide(r, false)}>Deny</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No refund requests</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}