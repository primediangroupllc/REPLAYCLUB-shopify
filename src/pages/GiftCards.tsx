import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Gift, Send, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import SeoHead from "@/components/SeoHead";

const TIERS = [
  { amount: 2500, label: "$25", description: "Perfect for a quick session" },
  { amount: 5000, label: "$50", description: "A full studio experience" },
  { amount: 10000, label: "$100", description: "The ultimate gift" },
];

const GiftCards = () => {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "true";
  const giftCode = searchParams.get("code");
  const canceled = searchParams.get("canceled") === "true";

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePurchase = async () => {
    if (!selectedAmount) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gift-card-payment", {
        body: {
          amountCents: selectedAmount,
          recipientEmail: recipientEmail || undefined,
          recipientName: recipientName || undefined,
          personalMessage: personalMessage || undefined,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create payment", variant: "destructive" });
      setLoading(false);
    }
  };

  if (success && giftCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="chrome-surface border border-border depth-shadow-lg rounded-lg p-8 max-w-md w-full text-center space-y-6"
        >
          <img src={logo} alt="Replay Club" className="h-14 mx-auto mix-blend-screen" />
          <div className="text-4xl">🎁</div>
          <h1 className="font-display text-xl font-bold chrome-text">Gift Card Purchased!</h1>
          <div className="bg-secondary rounded-md p-4 border border-border">
            <p className="text-muted-foreground text-xs font-body mb-2">Your gift card code</p>
            <p className="font-display text-2xl font-bold text-foreground tracking-widest">{giftCode}</p>
          </div>
          <p className="text-muted-foreground text-xs font-body">
            Share this code with the recipient. They can apply it during booking checkout.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/"
              className="chrome-btn font-display font-semibold text-xs uppercase tracking-[0.15em] px-6 py-3 rounded-md"
            >
              Return Home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Studio Gift Cards | Replay Club"
        description="Give the gift of studio time. Replay Club gift cards in $25, $50, and $100 — redeemable on DJ sessions, podcast recording, livestreams, and equipment rentals in Los Angeles."
        path="/gift-cards"
      />
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="w-16" />
          <img src={logo} alt="Replay Club" className="h-8 mix-blend-screen" />
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <Gift className="w-10 h-10 text-chrome mx-auto" />
          <h1 className="font-display text-3xl font-bold chrome-text">Gift Cards</h1>
          <p className="text-muted-foreground font-body text-sm max-w-md mx-auto">
            Give the gift of studio time. Choose an amount and we'll generate a unique code.
          </p>
        </motion.div>

        {canceled && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 text-center">
            <p className="text-destructive text-sm font-body">Payment was canceled. No charge was made.</p>
          </div>
        )}

        {/* Amount Selection */}
        <div className="space-y-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Choose Amount
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {TIERS.map((tier) => (
              <motion.button
                key={tier.amount}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedAmount(tier.amount)}
                className={`relative p-5 rounded-lg border transition-all text-center ${
                  selectedAmount === tier.amount
                    ? "border-chrome bg-secondary depth-shadow"
                    : "border-border bg-card hover:border-chrome/50"
                }`}
              >
                {selectedAmount === tier.amount && (
                  <Check className="absolute top-2 right-2 w-4 h-4 text-chrome" />
                )}
                <p className="font-display text-2xl font-bold text-foreground">{tier.label}</p>
                <p className="text-muted-foreground text-xs font-body mt-1">{tier.description}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Recipient Details (optional) */}
        <div className="space-y-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recipient Details <span className="text-muted-foreground/50">(optional)</span>
          </h2>
          <div className="chrome-surface border border-border rounded-lg p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-display uppercase tracking-wider text-muted-foreground">Name</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Their name"
                  className="mt-1 bg-background border-border"
                />
              </div>
              <div>
                <Label className="text-xs font-display uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="their@email.com"
                  className="mt-1 bg-background border-border"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-display uppercase tracking-wider text-muted-foreground">Personal Message</Label>
              <Input
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder="Enjoy your session!"
                className="mt-1 bg-background border-border"
              />
            </div>
          </div>
        </div>

        {/* Purchase Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handlePurchase}
          disabled={!selectedAmount || loading}
          className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-10 py-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Purchase Gift Card
              {selectedAmount && ` — $${(selectedAmount / 100).toFixed(0)}`}
            </>
          )}
        </motion.button>

        {/* Redeem Section */}
        <div className="border-t border-border pt-8 text-center space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Have a gift card?
          </h2>
          <p className="text-muted-foreground text-xs font-body">
            Enter your code during checkout to apply your gift card balance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GiftCards;
