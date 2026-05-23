import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import { Trash2, Mail, AlertCircle } from "lucide-react";

interface Suppressed {
  id: string;
  email: string;
  reason: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface FailedSend {
  id: string;
  recipient_email: string;
  template_name: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function AdminBounces() {
  const [suppressed, setSuppressed] = useState<Suppressed[]>([]);
  const [failures, setFailures] = useState<FailedSend[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [supRes, failRes] = await Promise.all([
      (supabase as any)
        .from("suppressed_emails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      (supabase as any)
        .from("email_send_log")
        .select("id, recipient_email, template_name, status, error_message, created_at")
        .in("status", ["failed", "bounced", "complained", "dlq"])
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setSuppressed((supRes.data ?? []) as Suppressed[]);
    setFailures((failRes.data ?? []) as FailedSend[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (row: Suppressed) => {
    if (!confirm(`Remove ${row.email} from the suppression list?`)) return;
    const { error } = await (supabase as any)
      .from("suppressed_emails")
      .delete()
      .eq("id", row.id);
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    await logAdminAction("delete", "suppressed_email", row.id, { email: row.email });
    toast({ title: `Removed ${row.email}` });
    load();
  };

  const filtered = suppressed.filter((r) =>
    !filter || r.email.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" /> Suppressed Emails ({suppressed.length})
          </CardTitle>
          <CardDescription>
            Addresses that have bounced, complained, or unsubscribed. They are blocked from receiving transactional mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Filter by email…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell>
                    <Badge variant={r.reason === "bounced" || r.reason === "complained" ? "destructive" : "secondary"}>
                      {r.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No suppressed emails
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Recent Send Failures
          </CardTitle>
          <CardDescription>Last 100 failed deliveries from the email queue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failures.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.recipient_email}</TableCell>
                  <TableCell className="text-xs">{f.template_name}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{f.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-xs truncate" title={f.error_message ?? ""}>
                    {f.error_message ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {failures.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No recent failures
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}