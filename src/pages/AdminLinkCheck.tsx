import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ExternalLink, RefreshCw, Copy, CheckCircle2, XCircle, Clock } from "lucide-react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { useAdminSessionTimeout } from "@/hooks/useAdminSessionTimeout";

interface MasterLink {
  url: string;
  expected: string;
}

interface CheckResult {
  url: string;
  fullUrl: string;
  status: number | null;
  finalUrl: string | null;
  ok: boolean;
  durationMs: number;
  checkedAt: string;
  error?: string;
}

const MASTER_LINKS: MasterLink[] = [
  // Public landing
  { url: "/", expected: "Homepage with hero + service tabs" },
  { url: "/music", expected: "Music studio landing OR redirect to / with music tab" },
  { url: "/podcast", expected: "Podcast studio landing OR redirect to / with podcast tab" },
  { url: "/dj", expected: "DJ studio landing OR redirect to / with dj tab" },
  { url: "/livestream", expected: "Livestream studio landing OR redirect to / with livestream tab" },

  // Booking deep links — ad destinations
  { url: "/?book=music", expected: "Anon → /auth, then home with Music modal open" },
  { url: "/?book=podcast", expected: "Anon → /auth, then home with Podcast modal open" },
  { url: "/?book=dj", expected: "Anon → /auth, then home with DJ modal open" },
  { url: "/?book=livestream", expected: "Anon → /auth, then home with Livestream modal open" },
  { url: "/music?book=1", expected: "Anon → /auth, then /music with modal open" },
  { url: "/podcast?book=1", expected: "Anon → /auth, then /podcast with modal open" },
  { url: "/dj?book=1", expected: "Anon → /auth, then /dj with modal open" },
  { url: "/livestream?book=1", expected: "Anon → /auth, then /livestream with modal open" },

  // Auth deep links
  { url: "/auth", expected: "Sign in / sign up" },
  { url: "/auth?mode=signup", expected: "Land on signup tab" },
  { url: "/auth?mode=signin", expected: "Land on signin tab" },

  // Other
  { url: "/about", expected: "About page if exists" },
  { url: "/contact", expected: "Contact page if exists" },
  { url: "/policies", expected: "Refund / cancellation page if exists" },
];

const STORAGE_KEY = "admin-link-check:behavior-verified";

export default function AdminLinkCheck() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  useAdminSessionTimeout(authorized === true);
  const [base, setBase] = useState<string>("https://replayclub.io");
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);
  const [verified, setVerified] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(verified));
    } catch {
      /* ignore quota */
    }
  }, [verified]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r) => r.role === "admin");
      setAuthorized(!!isAdmin);
    })();
  }, [navigate]);

  const runAll = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-link-check", {
        body: { urls: MASTER_LINKS.map((l) => l.url), base },
      });
      if (error) throw error;
      const next: Record<string, CheckResult> = {};
      for (const r of (data?.results ?? []) as CheckResult[]) {
        next[r.url] = r;
      }
      setResults(next);
      toast({ title: "Link check complete", description: `${Object.values(next).filter((r) => r.ok).length}/${MASTER_LINKS.length} returned 2xx` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Link check failed", description: msg, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const csv = useMemo(() => {
    const head = ["URL", "Expected", "HTTP Status", "Final URL", "OK", "Behavior Verified", "Duration (ms)", "Checked At", "Error"];
    const rows = MASTER_LINKS.map((link) => {
      const r = results[link.url];
      const cells = [
        link.url,
        link.expected,
        r?.status ?? "",
        r?.finalUrl ?? "",
        r ? (r.ok ? "yes" : "no") : "",
        verified[link.url] ? "yes" : "no",
        r?.durationMs ?? "",
        r?.checkedAt ?? "",
        r?.error ?? "",
      ];
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    return [head.join(","), ...rows].join("\n");
  }, [results, verified]);

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      toast({ title: "Copied", description: "CSV copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Checking access…</div>
      </div>
    );
  }
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Card className="p-6 max-w-md text-center">
          <h1 className="text-lg font-semibold mb-2">Admins only</h1>
          <p className="text-sm text-muted-foreground mb-4">You don't have access to this page.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Back to home</Button>
        </Card>
      </div>
    );
  }

  const okCount = Object.values(results).filter((r) => r.ok).length;
  const failCount = Object.values(results).filter((r) => r && !r.ok).length;

  return (
    <AdminPageShell>
    <div className="bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-semibold chrome-text">Master Link Check</h1>
        </div>

        <Card className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <Label htmlFor="base" className="text-xs uppercase tracking-wider text-muted-foreground">
                Base URL
              </Label>
              <Input
                id="base"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="https://replayclub.io"
                className="mt-1"
              />
            </div>
            <Button onClick={runAll} disabled={running}>
              <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
              {running ? "Running…" : "Run all checks"}
            </Button>
            <Button variant="outline" onClick={copyCsv} disabled={Object.keys(results).length === 0}>
              <Copy className="w-4 h-4 mr-2" />
              Copy as CSV
            </Button>
          </div>
          {Object.keys(results).length > 0 && (
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-400">✓ {okCount} OK</span>
              <span className="text-rose-400">✕ {failCount} failed</span>
              <span className="text-muted-foreground">of {MASTER_LINKS.length} total</span>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">URL</th>
                  <th className="text-left p-3">Expected</th>
                  <th className="text-left p-3 w-20">HTTP</th>
                  <th className="text-left p-3">Final URL</th>
                  <th className="text-left p-3 w-24">Time</th>
                  <th className="text-left p-3 w-32">Behavior verified</th>
                  <th className="text-left p-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {MASTER_LINKS.map((link) => {
                  const r = results[link.url];
                  return (
                    <tr key={link.url} className="border-t border-border/40 align-top">
                      <td className="p-3 font-mono text-xs">{link.url}</td>
                      <td className="p-3 text-muted-foreground text-xs max-w-xs">{link.expected}</td>
                      <td className="p-3">
                        {!r ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : r.error ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-xs">
                            <XCircle className="w-3.5 h-3.5" /> {r.error}
                          </span>
                        ) : r.ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {r.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-xs">
                            <XCircle className="w-3.5 h-3.5" /> {r.status}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground break-all max-w-md">
                        {r?.finalUrl ?? "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {r.durationMs}ms
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`v-${link.url}`}
                            checked={!!verified[link.url]}
                            onCheckedChange={(v) =>
                              setVerified((prev) => ({ ...prev, [link.url]: !!v }))
                            }
                          />
                          <label htmlFor={`v-${link.url}`} className="text-xs text-muted-foreground cursor-pointer">
                            tested
                          </label>
                        </div>
                      </td>
                      <td className="p-3">
                        <a
                          href={`${base}${link.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          HTTP check confirms the URL resolves with a 2xx. Query-param behavior (e.g. <code>?book=music</code> opening
          the modal) must be tested manually in a logged-out browser, then ticked above. The "behavior verified"
          column persists locally so you can resume a session.
        </p>
      </div>
    </div>
    </AdminPageShell>
  );
}