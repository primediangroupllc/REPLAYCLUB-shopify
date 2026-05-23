import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

export default function BookingDensitySettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState(30);
  const [dailyCap, setDailyCap] = useState(4);
  const [sharedPool, setSharedPool] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("booking_buffer_minutes, daily_session_cap, shared_room_pool")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setBufferMinutes(data.booking_buffer_minutes ?? 30);
        setDailyCap(data.daily_session_cap ?? 4);
        setSharedPool(data.shared_room_pool ?? true);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        booking_buffer_minutes: bufferMinutes,
        daily_session_cap: dailyCap,
        shared_room_pool: sharedPool,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save: " + error.message);
    } else {
      toast.success("Booking density settings saved.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Booking Density</h2>
        <p className="text-sm text-muted-foreground">
          Controls cross-type spacing and daily capacity for the shared studio room.
          Changes take effect immediately for new bookings.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="buffer">Buffer between sessions (minutes)</Label>
        <Input
          id="buffer"
          type="number"
          min={0}
          max={240}
          value={bufferMinutes}
          onChange={(e) => setBufferMinutes(Math.max(0, parseInt(e.target.value || "0", 10)))}
        />
        <p className="text-xs text-muted-foreground">
          Time blocked after each session ends before the next can start. Default: 30.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cap">Maximum sessions per day</Label>
        <Input
          id="cap"
          type="number"
          min={0}
          max={24}
          value={dailyCap}
          onChange={(e) => setDailyCap(Math.max(0, parseInt(e.target.value || "0", 10)))}
        />
        <p className="text-xs text-muted-foreground">
          Hard cap across all booking types per calendar day. Default: 4. Set to 0 to disable.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-4">
        <div className="space-y-1">
          <Label htmlFor="shared" className="text-sm">
            Treat all booking types as shared room
          </Label>
          <p className="text-xs text-muted-foreground">
            DJ, Podcast, Recording, and Backdrop share one physical space. Keep ON.
          </p>
        </div>
        <Switch id="shared" checked={sharedPool} onCheckedChange={setSharedPool} />
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Save settings
      </Button>
    </div>
  );
}
