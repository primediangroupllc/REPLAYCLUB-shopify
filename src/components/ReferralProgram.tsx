import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Share2, Copy, Check, DollarSign, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ReferralProgram = () => {
  const [referralCode, setReferralCode] = useState("");
  const [credits, setCredits] = useState({ total_referrals: 0, available_credits_cents: 0, used_credits_cents: 0 });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [profileRes, creditsRes] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", session.user.id).single(),
        supabase.rpc("get_referral_credits", { user_id: session.user.id }),
      ]);

      if (profileRes.data?.referral_code) setReferralCode(profileRes.data.referral_code);
      if (creditsRes.data) setCredits(creditsRes.data as any);
      setLoading(false);
    };
    load();
  }, []);

  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join Replay Club",
        text: "Book a DJ session at Replay Club and we both get $10 off!",
        url: referralLink,
      });
    } else {
      handleCopy();
    }
  };

  if (loading) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Share2 className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">Refer & Earn</h3>
      </div>

      <p className="text-xs font-body text-muted-foreground">
        Share your link — when a friend books, you earn <span className="text-primary font-semibold">$10 credit</span> toward your next session.
      </p>

      {/* Referral Link */}
      <div className="flex gap-2">
        <div className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-xs font-body text-muted-foreground truncate">
          {referralLink}
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-2 rounded-md chrome-btn-outline text-xs"
          title="Copy link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleShare}
          className="px-3 py-2 rounded-md chrome-btn text-xs"
          title="Share"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-secondary/50 rounded-md p-2.5 text-center">
          <Users className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
          <p className="font-display text-sm font-bold text-foreground">{credits.total_referrals}</p>
          <p className="text-[9px] font-body text-muted-foreground uppercase tracking-wider">Referrals</p>
        </div>
        <div className="bg-secondary/50 rounded-md p-2.5 text-center">
          <DollarSign className="w-3.5 h-3.5 mx-auto text-primary mb-1" />
          <p className="font-display text-sm font-bold text-primary">${(credits.available_credits_cents / 100).toFixed(0)}</p>
          <p className="text-[9px] font-body text-muted-foreground uppercase tracking-wider">Available</p>
        </div>
        <div className="bg-secondary/50 rounded-md p-2.5 text-center">
          <DollarSign className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
          <p className="font-display text-sm font-bold text-muted-foreground">${(credits.used_credits_cents / 100).toFixed(0)}</p>
          <p className="text-[9px] font-body text-muted-foreground uppercase tracking-wider">Used</p>
        </div>
      </div>
    </div>
  );
};

export default ReferralProgram;
