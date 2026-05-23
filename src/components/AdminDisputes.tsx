import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";

export function AdminDisputes() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("stripe_disputes")
        .select("*").order("created_at", { ascending: false }).limit(50);
      setRows(data ?? []);
    })();
  }, []);
  const now = Date.now();
  const urgent = rows.filter((r) => {
    if (!r.evidence_due_by || ["won","lost","warning_closed"].includes(r.status)) return false;
    const hours = (new Date(r.evidence_due_by).getTime() - now) / 3600_000;
    return hours < 72 && hours > 0;
  }).length;
  const overdue = rows.filter((r) => {
    if (!r.evidence_due_by || ["won","lost","warning_closed"].includes(r.status)) return false;
    return new Date(r.evidence_due_by).getTime() < now;
  }).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          Stripe Disputes
          {urgent > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" /> {urgent} due in &lt;72h
            </Badge>
          )}
          {overdue > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> {overdue} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dispute</TableHead><TableHead>Amount</TableHead><TableHead>Reason</TableHead>
              <TableHead>Status</TableHead><TableHead>Evidence due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const due = r.evidence_due_by ? new Date(r.evidence_due_by).getTime() : null;
              const open = !["won","lost","warning_closed"].includes(r.status);
              const isOverdue = due !== null && open && due < now;
              const isUrgent = due !== null && open && due > now && (due - now) < 72 * 3600_000;
              return (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.stripe_dispute_id}</TableCell>
                <TableCell>${(r.amount_cents/100).toFixed(2)}</TableCell>
                <TableCell>{r.reason}</TableCell>
                <TableCell><Badge variant={r.status === "lost" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                <TableCell className={`text-xs ${isOverdue ? "text-destructive font-semibold" : isUrgent ? "text-yellow-500 font-medium" : ""}`}>
                  {r.evidence_due_by ? new Date(r.evidence_due_by).toLocaleDateString() : "—"}
                  {isOverdue && " (overdue)"}
                </TableCell>
              </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No disputes</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}