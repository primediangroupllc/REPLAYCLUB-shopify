import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Clock, Users, MessageCircle, Send, UserPlus, Copy, Check, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ConsentBlock from "@/components/ConsentBlock";
import { dataUrlToBlob } from "@/lib/utils";
import logo from "@/assets/logo.png";

const MAX_GUESTS = 2;

interface SessionInvite {
  id: string;
  token: string;
  created_by_name: string;
  room_title: string;
  booking_date: string;
  booking_time: string;
}

interface Guest {
  id: string;
  guest_name: string;
  created_at: string;
}

interface Message {
  id: string;
  author_name: string;
  message: string;
  created_at: string;
}

const CountdownTimer = ({ targetDate, targetTime }: { targetDate: string; targetTime: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const [hours] = targetTime.split(":").map(Number);
      const target = new Date(`${targetDate}T${String(hours).padStart(2, "0")}:00:00`);
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setIsPast(true);
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate, targetTime]);

  if (isPast) {
    return (
      <div className="text-center">
        <p className="text-chrome font-display text-lg font-bold animate-pulse">🔴 LIVE NOW</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 justify-center">
      {[
        { label: "DAYS", value: timeLeft.days },
        { label: "HRS", value: timeLeft.hours },
        { label: "MIN", value: timeLeft.minutes },
        { label: "SEC", value: timeLeft.seconds },
      ].map((unit) => (
        <div key={unit.label} className="flex flex-col items-center">
          <div className="chrome-surface border border-border rounded-lg w-16 h-16 flex items-center justify-center">
            <span className="font-display text-2xl font-bold chrome-text">{String(unit.value).padStart(2, "0")}</span>
          </div>
          <span className="text-muted-foreground text-[10px] font-display tracking-widest mt-1">{unit.label}</span>
        </div>
      ))}
    </div>
  );
};

const SessionPage = () => {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<SessionInvite | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [addingGuest, setAddingGuest] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Consent state
  const [consentSignerName, setConsentSignerName] = useState("");
  const [consentSignature, setConsentSignature] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const { data: invArr } = await supabase
        .rpc("get_session_invite_by_token", { invite_token: token });
      const inv = invArr?.[0] || null;

      if (!inv) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setInvite(inv);

      const [{ data: g }, { data: m }] = await Promise.all([
        supabase
          .from("session_guests")
          .select("*")
          .eq("session_invite_id", inv.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("session_messages")
          .select("*")
          .eq("session_invite_id", inv.id)
          .order("created_at", { ascending: true }),
      ]);

      setGuests(g || []);
      setMessages(m || []);
      setLoading(false);
    };
    load();
  }, [token]);

  const handleAddGuest = async () => {
    if (!guestName.trim() || !invite) return;
    if (guests.length >= MAX_GUESTS) {
      toast.error(`Max ${MAX_GUESTS} guests. Contact the host to request more.`);
      return;
    }
    if (!idFile) {
      toast.error("Upload a photo of your government-issued ID first");
      return;
    }
    if (!consentSignature || !consentSignerName.trim()) {
      toast.error("Please sign the guest consent agreement first");
      return;
    }
    setAddingGuest(true);
    try {
      // 1. Upload ID photo to id-verification bucket (guest-invites folder)
      const ext = idFile.name.split(".").pop() || "jpg";
      const idPhotoPath = `guest-invites/${invite.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("id-verification")
        .upload(idPhotoPath, idFile, { contentType: idFile.type, upsert: false });
      if (uploadError) throw uploadError;

      // 2. Upload consent signature to private consent-signatures bucket
      let consentSignaturePath: string | null = null;
      try {
        const blob = dataUrlToBlob(consentSignature);
        const sigPath = `guest-invites/${invite.id}/${crypto.randomUUID()}.png`;
        const { error: sigErr } = await supabase.storage
          .from("consent-signatures")
          .upload(sigPath, blob, { contentType: "image/png" });
        if (!sigErr) consentSignaturePath = sigPath;
      } catch (e) {
        console.error("Signature upload failed", e);
      }

      // 3. Verify via edge function (will insert guest if approved)
      const { data, error: fnError } = await supabase.functions.invoke("verify-guest-id", {
        body: {
          sessionInviteId: invite.id,
          guestName: guestName.trim(),
          idPhotoPath,
          consentSignaturePath,
          consentSignerName: consentSignerName.trim(),
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (data?.guest) {
        setGuests((prev) => [...prev, data.guest]);
        setGuestName("");
        setIdFile(null);
        setConsentSignature(null);
        setConsentSignerName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast.success("ID verified — you're on the lineup! 🎧");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to verify ID");
    } finally {
      setAddingGuest(false);
    }
  };

  const handlePostMessage = async () => {
    if (!authorName.trim() || !messageText.trim() || !invite) return;
    setSendingMsg(true);
    const { data, error } = await supabase
      .from("session_messages")
      .insert({
        session_invite_id: invite.id,
        author_name: authorName.trim(),
        message: messageText.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data]);
      setMessageText("");
      toast.success("Message posted!");
    } else {
      toast.error("Failed to post message");
    }
    setSendingMsg(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-chrome border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="text-4xl">🔗</p>
          <h1 className="font-display text-xl font-bold text-foreground">Session Not Found</h1>
          <p className="text-muted-foreground text-sm font-body">This session link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <img src={logo} alt="Replay Club" className="h-12 mx-auto" />
          <div>
            <p className="text-muted-foreground text-xs font-display uppercase tracking-widest">You're Invited To</p>
            <h1 className="font-display text-2xl font-bold chrome-text mt-1">{invite.room_title}</h1>
            <p className="text-muted-foreground text-sm font-body mt-1">
              Hosted by <span className="text-foreground font-semibold">{invite.created_by_name}</span>
            </p>
          </div>
          <div className="chrome-surface border border-border rounded-lg p-3 inline-flex items-center gap-2">
            <span className="text-foreground text-sm font-body">📅 {invite.booking_date} · {invite.booking_time}</span>
          </div>
        </motion.div>

        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="chrome-surface border border-border rounded-lg p-6"
        >
          <div className="flex items-center gap-2 mb-4 justify-center">
            <Clock className="h-4 w-4 text-chrome" />
            <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">Countdown</span>
          </div>
          <CountdownTimer targetDate={invite.booking_date} targetTime={invite.booking_time} />
        </motion.div>

        {/* Share Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="w-full border-border font-display text-xs uppercase tracking-widest"
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Link Copied!" : "Share This Session"}
          </Button>
        </motion.div>

        {/* Lineup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="chrome-surface border border-border rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-chrome" />
            <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">
              Lineup ({guests.length + 1})
            </span>
          </div>

          <div className="space-y-2">
            {/* Host */}
            <div className="flex items-center gap-3 p-2 rounded-md bg-secondary/50 border border-border">
              <div className="w-8 h-8 rounded-full bg-chrome/20 flex items-center justify-center">
                <span className="text-chrome text-xs font-bold">👑</span>
              </div>
              <div>
                <p className="text-foreground text-sm font-display font-semibold">{invite.created_by_name}</p>
                <p className="text-muted-foreground text-[10px] font-body">Host</p>
              </div>
            </div>

            {/* Guests */}
            {guests.map((guest) => (
              <div key={guest.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/30">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-foreground text-xs font-bold">🎧</span>
                </div>
                <p className="text-foreground text-sm font-display">{guest.guest_name}</p>
              </div>
            ))}
          </div>

          {/* Add yourself */}
          {guests.length >= MAX_GUESTS ? (
            <div className="pt-2 border-t border-border">
              <p className="text-muted-foreground text-[11px] font-body text-center">
                This session is full ({MAX_GUESTS} guests max). Contact the host to request more.
              </p>
            </div>
          ) : (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-muted-foreground text-[11px] font-body flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Verify your government-issued ID to join — required by the studio.
              </p>
              <Input
                placeholder="Your full name (must match ID)"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="text-sm"
                maxLength={50}
              />
              <label className="flex items-center gap-2 cursor-pointer chrome-surface border border-border rounded-md px-3 py-2 hover:border-foreground/50 transition-colors">
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-body text-muted-foreground truncate">
                  {idFile ? idFile.name : "Upload photo of your ID"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                />
              </label>

              {/* Guest consent */}
              <div className="pt-3 mt-1 border-t border-border">
                <ConsentBlock
                  variant="guest"
                  signerName={consentSignerName}
                  onSignerNameChange={setConsentSignerName}
                  onSignatureChange={setConsentSignature}
                />
              </div>

              <Button
                onClick={handleAddGuest}
                disabled={
                  !guestName.trim() ||
                  !idFile ||
                  !consentSignature ||
                  !consentSignerName.trim() ||
                  addingGuest
                }
                size="sm"
                className="chrome-btn w-full"
              >
                {addingGuest ? (
                  "Verifying ID..."
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign & Join Lineup
                  </>
                )}
              </Button>
            </div>
          )}
        </motion.div>

        {/* Comment Wall */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="chrome-surface border border-border rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-chrome" />
            <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">
              Wall ({messages.length})
            </span>
          </div>

          {/* Messages */}
          {messages.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className="p-3 rounded-md bg-secondary/30 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-foreground text-sm font-display font-semibold">{msg.author_name}</span>
                    <span className="text-muted-foreground text-[10px] font-body">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-foreground/80 text-sm font-body">{msg.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center font-body py-4">
              No messages yet — be the first! 💬
            </p>
          )}

          {/* Post message */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Input
              placeholder="Your name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="text-sm"
              maxLength={50}
            />
            <div className="flex gap-2">
              <Textarea
                placeholder="Say something..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="text-sm min-h-[60px] resize-none"
                maxLength={500}
              />
              <Button
                onClick={handlePostMessage}
                disabled={!authorName.trim() || !messageText.trim() || sendingMsg}
                size="sm"
                className="chrome-btn shrink-0 self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SessionPage;
