import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Copy, Send, Trash2, Check, Gift, ArrowLeft, Tag, Plus } from "lucide-react";
import logo from "@/assets/logo.png";
import { logAdminAction } from "@/lib/auditLog";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { useAdminSessionTimeout } from "@/hooks/useAdminSessionTimeout";

const ROOMS = ["Disk Jockey", "Podcast", "Studio Sesh", "Photoshoot", "Livestream"];

function generateCode() {
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

function generateToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

const AdminPromo = () => {
  const [promos, setPromos] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useAdminSessionTimeout(isAdmin === true);

  // Discount codes (dollar-off, single-use, any studio)
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [discountAmount, setDiscountAmount] = useState(10);
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountExpiresDays, setDiscountExpiresDays] = useState<number | "">("");
  const [discountLoading, setDiscountLoading] = useState(false);
  const [copiedDiscountId, setCopiedDiscountId] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
    loadPromos();
    loadDiscounts();
  }, []);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    const { data } = await supabase.rpc("has_role", {
      _user_id: session.user.id,
      _role: "admin" as const,
    });
    if (!data) {
      navigate("/");
      return;
    }
    setIsAdmin(true);
  };

  const loadPromos = async () => {
    const { data } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPromos(data);
  };

  const createPromo = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.from("promo_codes").insert({
        token: generateToken(),
        code: generateCode(),
        room_title: selectedRoom,
        created_by: session.user.id,
      });

      if (error) throw error;
      toast({ title: "Promo link created!" });
      loadPromos();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async (promoId: string) => {
    if (!recipientEmail) {
      toast({ title: "Enter an email address", variant: "destructive" });
      return;
    }
    setSendingId(promoId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("send-promo-code", {
        body: { promo_id: promoId, recipient_email: recipientEmail },
      });

      if (error) throw error;
      toast({ title: "Code sent!", description: `Sent to ${recipientEmail}` });
      setRecipientEmail("");
      loadPromos();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/promo/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(token);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deletePromo = async (id: string) => {
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Promo deleted" });
      logAdminAction("delete", "promo_code", id);
      loadPromos();
    }
  };

  // ===== Discount codes =====
  const loadDiscounts = async () => {
    const { data } = await supabase
      .from("discount_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setDiscounts(data);
  };

  const generateDiscountCode = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
    let out = "RC";
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const createDiscount = async () => {
    if (discountAmount <= 0 || discountAmount > 500) {
      toast({ title: "Invalid amount", description: "Enter $1–$500", variant: "destructive" });
      return;
    }
    setDiscountLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const expiresAt =
        typeof discountExpiresDays === "number" && discountExpiresDays > 0
          ? new Date(Date.now() + discountExpiresDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const { error } = await supabase.from("discount_codes").insert({
        token: generateToken(),
        code: generateDiscountCode(),
        amount_cents: Math.round(discountAmount * 100),
        label: discountLabel.trim() || null,
        expires_at: expiresAt,
        created_by: session.user.id,
      });

      if (error) throw error;
      toast({ title: `$${discountAmount} discount code created!` });
      setDiscountLabel("");
      setDiscountExpiresDays("");
      loadDiscounts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDiscountLoading(false);
    }
  };

  const copyDiscountCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedDiscountId(code);
    toast({ title: "Code copied!", description: code });
    setTimeout(() => setCopiedDiscountId(null), 2000);
  };

  const deleteDiscount = async (id: string) => {
    const { error } = await supabase.from("discount_codes").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Discount deleted" });
      logAdminAction("delete", "discount_code", id);
      loadDiscounts();
    }
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AdminPageShell>
    <div className="bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="w-5" />
          <img src={logo} alt="Replay Club" className="w-32 mix-blend-screen" />
          <div className="w-5" />
        </div>

        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-foreground flex items-center justify-center gap-2">
            <Gift className="w-5 h-5" /> Promo Links
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">Create single-use free session links</p>
        </div>

        {/* Create new promo */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="chrome-surface rounded-lg p-6 space-y-4"
        >
          <h2 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">New Promo</h2>
          <div className="space-y-3">
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ROOMS.map((room) => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
            <button
              onClick={createPromo}
              disabled={loading}
              className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all disabled:opacity-50"
            >
              {loading ? "Creating..." : "Generate Promo Link"}
            </button>
          </div>
        </motion.div>

        {/* Promo list */}
        <div className="space-y-3">
          {promos.map((promo, i) => (
            <motion.div
              key={promo.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`chrome-surface rounded-lg p-4 space-y-3 ${promo.redeemed ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-sm font-semibold text-foreground">{promo.room_title}</p>
                  <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">
                    Code: {promo.code} • {promo.redeemed ? "✓ Redeemed" : "Active"}
                  </p>
                  {promo.recipient_email && (
                    <p className="text-[10px] text-muted-foreground font-body mt-0.5">
                      Sent to: {promo.recipient_email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyLink(promo.token)}
                    className="p-2 rounded-md bg-card hover:bg-accent transition-colors"
                    title="Copy link"
                  >
                    {copiedId === promo.token ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {!promo.redeemed && (
                    <button
                      onClick={() => deletePromo(promo.id)}
                      className="p-2 rounded-md bg-card hover:bg-destructive/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Send code to email */}
              {!promo.redeemed && !promo.recipient_email && (
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Recipient email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="flex-1 bg-card border border-border text-foreground rounded-md px-3 py-2 text-xs font-body focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => sendCode(promo.id)}
                    disabled={sendingId === promo.id}
                    className="chrome-btn-outline px-3 py-2 rounded-md text-xs font-display font-semibold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    {sendingId === promo.id ? "..." : "Send"}
                  </button>
                </div>
              )}
            </motion.div>
          ))}

          {promos.length === 0 && (
            <p className="text-center text-muted-foreground text-sm font-body py-8">
              No promo links yet. Create one above.
            </p>
          )}
        </div>

        {/* ===== Discount Codes (dollar-off, single-use, any studio) ===== */}
        <div className="text-center pt-4">
          <h1 className="font-display text-xl font-bold text-foreground flex items-center justify-center gap-2">
            <Tag className="w-5 h-5" /> Discount Codes
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            Single-use dollar-off codes valid in any studio
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="chrome-surface rounded-lg p-6 space-y-4"
        >
          <h2 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
            New Discount
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                Amount ($)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                Label (optional)
              </label>
              <input
                type="text"
                value={discountLabel}
                onChange={(e) => setDiscountLabel(e.target.value)}
                placeholder="e.g. Launch promo"
                className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
                Expires in (days, optional)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={discountExpiresDays}
                onChange={(e) => {
                  const v = e.target.value;
                  setDiscountExpiresDays(v === "" ? "" : Math.max(1, Number(v)));
                }}
                placeholder="e.g. 30 — leave blank for no expiration"
                className="w-full bg-card border border-border text-foreground rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <button
            onClick={createDiscount}
            disabled={discountLoading}
            className="w-full chrome-btn font-display font-semibold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {discountLoading ? "Creating..." : `Generate $${discountAmount} Discount Code`}
          </button>
        </motion.div>

        <div className="space-y-3">
          {discounts.map((d, i) => {
            const isExpired = d.expires_at && new Date(d.expires_at).getTime() < Date.now();
            const inactive = d.redeemed || isExpired;
            return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`chrome-surface rounded-lg p-4 space-y-2 ${inactive ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold text-foreground tracking-wider">
                    {d.code}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">
                    ${(d.amount_cents / 100).toFixed(2)} off
                    {d.label ? ` • ${d.label}` : ""}
                    {" • "}
                    {d.redeemed ? "✓ Redeemed" : isExpired ? "⏱ Expired" : "Active"}
                  </p>
                  {d.expires_at && !d.redeemed && (
                    <p className="text-[10px] text-muted-foreground font-body mt-0.5">
                      {isExpired ? "Expired" : "Expires"}: {new Date(d.expires_at).toLocaleDateString()}
                    </p>
                  )}
                  {d.redeemed_by_email && (
                    <p className="text-[10px] text-muted-foreground font-body mt-0.5 truncate">
                      Used by: {d.redeemed_by_email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyDiscountCode(d.code)}
                    className="p-2 rounded-md bg-card hover:bg-accent transition-colors"
                    title="Copy code"
                  >
                    {copiedDiscountId === d.code ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {!d.redeemed && (
                    <button
                      onClick={() => deleteDiscount(d.id)}
                      className="p-2 rounded-md bg-card hover:bg-destructive/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
            );
          })}

          {discounts.length === 0 && (
            <p className="text-center text-muted-foreground text-sm font-body py-8">
              No discount codes yet. Generate one above.
            </p>
          )}
        </div>
      </div>
    </div>
    </AdminPageShell>
  );
};

export default AdminPromo;
