import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReminderPreferencesProps {
  userEmail: string;
  userId: string | null;
}

const ReminderPreferences = ({ userEmail, userId }: ReminderPreferencesProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userEmail) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("reminder_preferences")
        .select("email_enabled, sms_enabled")
        .ilike("user_email", userEmail)
        .maybeSingle();
      if (!cancelled) {
        if (!error && data) {
          setEmailEnabled(data.email_enabled);
          setSmsEnabled(data.sms_enabled);
        }
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const persist = async (next: { email_enabled: boolean; sms_enabled: boolean }) => {
    setSaving(true);
    const { error } = await supabase
      .from("reminder_preferences")
      .upsert(
        {
          user_email: userEmail.toLowerCase(),
          user_id: userId,
          email_enabled: next.email_enabled,
          sms_enabled: next.sms_enabled,
        },
        { onConflict: "user_email" }
      );
    setSaving(false);
    if (error) {
      toast({
        title: "Couldn't save preferences",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Preferences updated",
        description: "We'll respect your reminder choices.",
      });
    }
  };

  const handleEmailToggle = (checked: boolean) => {
    setEmailEnabled(checked);
    persist({ email_enabled: checked, sms_enabled: smsEnabled });
  };

  const handleSmsToggle = (checked: boolean) => {
    setSmsEnabled(checked);
    persist({ email_enabled: emailEnabled, sms_enabled: checked });
  };

  return (
    <div className="card-premium p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-primary" />
        <p className="font-display text-sm font-semibold text-foreground tracking-wide uppercase">
          Session Reminders
        </p>
        {(loading || saving) && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
        We'll remind you 2 hours before each session so you can pack up and head over.
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 py-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-display text-foreground">Email reminders</p>
              <p className="text-[10px] text-muted-foreground font-body">Sent to {userEmail || "your inbox"}</p>
            </div>
          </div>
          <Switch checked={emailEnabled} onCheckedChange={handleEmailToggle} disabled={loading || saving} />
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-display text-foreground">SMS reminders</p>
              <p className="text-[10px] text-muted-foreground font-body">
                Sent to the phone number on your booking
              </p>
            </div>
          </div>
          <Switch checked={smsEnabled} onCheckedChange={handleSmsToggle} disabled={loading || saving} />
        </div>
      </div>
    </div>
  );
};

export default ReminderPreferences;
