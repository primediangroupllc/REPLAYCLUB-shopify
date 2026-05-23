import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  bookingDate: string;
  bookingTime: string;
  amountCents: number;
  onComplete?: () => void;
}

export function RefundRequestDialog({ open, onOpenChange, bookingId, bookingDate, bookingTime, amountCents, onComplete }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const sessionStart = new Date(`${bookingDate}T${bookingTime || "00:00"}`);
  const hoursBefore = (sessionStart.getTime() - Date.now()) / 36e5;
  const willAutoApprove = hoursBefore >= 24;

  const submit = async () => {
    if (reason.trim().length < 5) {
      toast({ title: "Please describe the reason", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("request-refund", {
      body: { booking_id: bookingId, reason: reason.trim() },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast({ title: "Refund request failed", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({
      title: (data as any)?.auto_approved ? "Refund issued" : "Refund request submitted",
      description: (data as any)?.auto_approved
        ? "Funds will appear in 5-10 business days."
        : "Our team will review within 48 hours.",
    });
    onOpenChange(false);
    onComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request refund</DialogTitle>
          <DialogDescription>
            Refund amount: ${(amountCents / 100).toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <AlertDescription>
            {willAutoApprove
              ? "Your session is more than 24h away — refund will be auto-approved and processed immediately."
              : "Your session is within 24h. Refund requires admin review and is not guaranteed."}
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <Label htmlFor="refund-reason">Reason</Label>
          <Textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us why you're requesting a refund…"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}