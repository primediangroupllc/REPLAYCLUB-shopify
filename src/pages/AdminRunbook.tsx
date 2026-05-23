import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, KeyRound, Mail, RefreshCw, CreditCard, Database, Activity, ShieldAlert } from "lucide-react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";

/**
 * Operations runbook — single page summarizing how to recover from the most
 * likely incidents. Restricted to admins. Designed for "it's 2am and something
 * is broken" — concrete commands and next steps, not philosophy.
 */
export default function AdminRunbook() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); return; }
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setAllowed(!!data);
    })();
  }, []);

  if (allowed === null) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <p className="text-lg">Admins only.</p>
        <Button onClick={() => navigate("/")} variant="outline">Go home</Button>
      </div>
    );
  }

  return (
    <AdminPageShell>
    <div className="bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Operations Runbook</h1>
            <Badge variant="outline">v1</Badge>
          </div>
          <p className="text-muted-foreground">
            Quick reference for handling incidents. All procedures assume admin access.
          </p>
        </div>

        <Card className="mb-6 border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4" /> First, check status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. Hit <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/functions/v1/health</code> — should return <code>200</code> with all checks <code>ok</code>.</p>
            <p>2. Check <strong>Admin Dashboard → Error Budget</strong> for recent 5xx spikes.</p>
            <p>3. Check <strong>Admin Dashboard → Webhook Events</strong> for stuck Stripe events.</p>
            <p>4. Check <strong>Admin Dashboard → Bounces</strong> for email delivery problems.</p>
          </CardContent>
        </Card>

        <Accordion type="single" collapsible className="space-y-3">
          <AccordionItem value="dlq" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> Replay a dead-letter (DLQ) email</div>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2 pb-4">
              <p>When an email fails repeatedly, it lands in the DLQ queue.</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open <strong>Admin Dashboard → Bounces / Email log</strong> and find the failing message.</li>
                <li>Identify the source queue (e.g. <code>auth_emails</code>) and the DLQ name (e.g. <code>auth_emails_dlq</code>).</li>
                <li>Call the <code>replay-dlq-message</code> edge function with <code>{`{ dlq_name, message_id, target_queue, payload }`}</code>.</li>
                <li>Confirm a new entry appears in <code>email_send_log</code> with status <code>sent</code>.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="webhook" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Replay a Stripe webhook event</div>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2 pb-4">
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open <strong>Admin Dashboard → Webhook Events</strong>.</li>
                <li>Find the <code>failed</code> event by Stripe event ID.</li>
                <li>Click <strong>Replay</strong> — this re-invokes <code>replay-webhook-event</code> server-side.</li>
                <li>If it still fails, inspect the payload. Common causes: missing booking row, lock already released, Stripe key rotation.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dispute" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Handle a Stripe dispute</div>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2 pb-4">
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open <strong>Admin Dashboard → Disputes</strong> — auto-synced from Stripe webhooks.</li>
                <li>Pull the related booking: customer email, session date, ID-verification status, consent signature.</li>
                <li>In the Stripe dashboard, submit evidence: receipt PDF, signed consent, ID match.</li>
                <li>Mark the dispute resolved internally; the webhook will reconcile the final state.</li>
              </ol>
              <p className="text-muted-foreground text-xs">Evidence deadline is in the dispute row. Don't miss it — Stripe auto-rules in customer's favor.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="keys" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Rotate API keys</div>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2 pb-4">
              <p>Rotate via <strong>Lovable Cloud → Connectors</strong> (anon/service keys) or the third-party dashboard (Stripe, Twilio).</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Generate the new key in the source system.</li>
                <li>Update the corresponding secret in Lovable Cloud.</li>
                <li>Edge functions pick up the new value on next cold start (~30s).</li>
                <li>Hit <code>/health</code> to confirm Stripe + DB checks pass.</li>
                <li>Revoke the old key once health is green for 5 minutes.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="restore" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2"><Database className="w-4 h-4" /> Investigate data drift</div>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2 pb-4">
              <p>The <code>integrity_snapshots</code> table captures daily counts of bookings, RSVPs, mixes, etc.</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Query <code>integrity_snapshots</code> ordered by <code>snapshot_date desc</code>.</li>
                <li>If a count dropped unexpectedly, check the corresponding table for hard deletes.</li>
                <li>If recovery is needed, restore from the most recent backup via <strong>Lovable Cloud</strong>.</li>
              </ol>
              <p className="text-muted-foreground text-xs">Snapshots are written daily by <code>capture_integrity_snapshot()</code>.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="locks" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Stuck slot locks</div>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-2 pb-4">
              <p>If a customer reports "this slot looks taken but no booking exists":</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open <strong>Admin Dashboard → Slot Locks</strong>.</li>
                <li>Filter by date/room — find locks past <code>expires_at</code> that weren't cleaned up.</li>
                <li>Click <strong>Release</strong>, or wait for the next <code>cleanup_expired_slot_locks</code> cron tick.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Escalation</CardTitle>
            <CardDescription>When the runbook doesn't cover it.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>1. Capture <code>/health</code> output, recent error budget chart, and relevant <code>failure_reports</code> rows.</p>
            <p>2. Email <a href="mailto:replayclubrecords@gmail.com" className="text-primary underline">replayclubrecords@gmail.com</a> with the snapshot.</p>
            <p>3. If customer-impacting, post a status note on the homepage banner.</p>
          </CardContent>
        </Card>
      </div>
    </div>
    </AdminPageShell>
  );
}