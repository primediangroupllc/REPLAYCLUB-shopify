import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Download, AlertTriangle } from "lucide-react";

export function AccountDeletionPanel() {
  const [pending, setPending] = useState<{ id: string; scheduled_for: string } | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase as any).from("account_deletion_requests")
      .select("id, scheduled_for")
      .eq("user_id", user.id).eq("status", "pending").maybeSingle();
    setPending(data ?? null);
  };

  useEffect(() => { refresh(); }, []);

  const exportData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
    setLoading(false);
    if (!r.ok) { toast({ title: "Export failed", variant: "destructive" }); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "replayclub-data.json"; a.click();
    toast({ title: "Data exported" });
  };

  const requestDeletion = async () => {
    setLoading(true);
    const { error } = await supabase.functions.invoke("request-account-deletion", { body: { reason } });
    setLoading(false);
    if (error) { toast({ title: "Request failed", variant: "destructive" }); return; }
    toast({ title: "Account deletion scheduled" });
    setReason(""); refresh();
  };

  const cancelDeletion = async () => {
    setLoading(true);
    await supabase.functions.invoke("request-account-deletion", { body: { action: "cancel" } });
    setLoading(false);
    toast({ title: "Deletion cancelled" });
    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy & Account</CardTitle>
        <CardDescription>Export your data or request account deletion (GDPR).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" onClick={exportData} disabled={loading} className="gap-2">
          <Download className="h-4 w-4" /> Download my data
        </Button>

        {pending ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div>
                Account deletion scheduled for{" "}
                <strong>{new Date(pending.scheduled_for).toLocaleDateString()}</strong>.
                Financial records will be retained per tax regulations; personal data will be removed.
              </div>
              <Button size="sm" variant="secondary" onClick={cancelDeletion} disabled={loading}>
                Cancel deletion
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Delete your account. Personal info will be anonymized after a 30-day grace period.
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional: tell us why you're leaving"
              rows={2}
            />
            <Button variant="destructive" size="sm" onClick={requestDeletion} disabled={loading}>
              Request account deletion
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}