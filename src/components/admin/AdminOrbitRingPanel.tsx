import { useEffect, useState } from "react";
import { Save, RotateCcw, Plus, Trash2, ArrowUp, ArrowDown, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import { DEFAULT_ORBIT_NODES, type OrbitNode } from "@/hooks/useSiteSettings";

/**
 * Admin: Orbit Ring editor.
 *
 * Backed by site_settings.orbit_enabled (boolean) and site_settings.orbit_nodes
 * (jsonb array). Customer homepage reads via usePublicSiteSettings; if the list
 * is empty or fetch fails it falls back to DEFAULT_ORBIT_NODES so the orbit is
 * never broken. The master toggle, when off, hides the orbit completely.
 *
 * Route field accepts:
 *   - internal path beginning with "/" (e.g. "/music-studio")
 *   - external URL beginning with "http(s)://" (opens in new tab)
 *   - homepage in-page tab name (e.g. "Backdrops", "Talent", "Equipment Rental")
 */

const reorder = <T,>(arr: T[], index: number, delta: number): T[] => {
  const next = [...arr];
  const target = index + delta;
  if (target < 0 || target >= next.length) return arr;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const newId = () => `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function AdminOrbitRingPanel() {
  const [enabled, setEnabled] = useState(true);
  const [nodes, setNodes] = useState<OrbitNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("orbit_enabled, orbit_nodes")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      const raw = Array.isArray((data as any)?.orbit_nodes) ? ((data as any).orbit_nodes as any[]) : [];
      const sanitized: OrbitNode[] = raw
        .filter((n) => n && typeof n.title === "string" && typeof n.route === "string")
        .map((n, idx) => ({
          id: typeof n.id === "string" && n.id ? n.id : `node-${idx}`,
          title: String(n.title),
          mobileLabel: typeof n.mobileLabel === "string" && n.mobileLabel ? n.mobileLabel : undefined,
          route: String(n.route),
        }));
      setEnabled((data as any)?.orbit_enabled !== false);
      // Seed with defaults so first-load admins see correct values to edit.
      setNodes(sanitized.length > 0 ? sanitized : DEFAULT_ORBIT_NODES);
      setLoaded(true);
    })();
  }, []);

  const update = (mut: () => void) => {
    mut();
    setDirty(true);
  };

  const handleAdd = () =>
    update(() => setNodes((prev) => [...prev, { id: newId(), title: "New node", route: "/" }]));

  const handleSave = async () => {
    setSaving(true);
    // Validate: title and route required, drop empties.
    const cleaned = nodes
      .map((n) => ({
        id: n.id || newId(),
        title: n.title.trim(),
        mobileLabel: n.mobileLabel?.trim() || undefined,
        route: n.route.trim(),
      }))
      .filter((n) => n.title && n.route);
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    const payload = { orbit_enabled: enabled, orbit_nodes: cleaned as any };
    const { error } = existing
      ? await supabase.from("site_settings").update(payload).eq("id", existing.id)
      : await supabase.from("site_settings").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    void logAdminAction("update", "site_settings", "orbit_ring", {
      orbit_enabled: enabled,
      orbit_nodes: cleaned,
    });
    setNodes(cleaned);
    setDirty(false);
    toast({ title: "Orbit ring saved", description: "Homepage updates on next page load." });
  };

  const handleRevert = async () => {
    setLoaded(false);
    const { data } = await supabase
      .from("site_settings")
      .select("orbit_enabled, orbit_nodes")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    const raw = Array.isArray((data as any)?.orbit_nodes) ? ((data as any).orbit_nodes as any[]) : [];
    setEnabled((data as any)?.orbit_enabled !== false);
    setNodes(raw.length > 0 ? (raw as OrbitNode[]) : DEFAULT_ORBIT_NODES);
    setDirty(false);
    setLoaded(true);
  };

  if (!loaded) {
    return (
      <div className="card-premium p-6 text-center text-sm text-muted-foreground font-body">
        Loading orbit ring…
      </div>
    );
  }

  return (
    <div className="card-premium p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">
              Orbit Ring
            </h3>
            <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
              Edit the rotating nodes around the homepage hero. Order matters — the first node sits
              at the top and the rest fan around clockwise.
            </p>
          </div>
        </div>
      </div>

      {/* Master toggle */}
      <label className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2.5">
        <div>
          <div className="text-xs font-display font-semibold uppercase tracking-wider text-foreground">
            Show orbit ring on homepage
          </div>
          <div className="text-[10px] text-muted-foreground font-body">
            When off, the orbit is hidden and the hero collapses cleanly with no empty space.
          </div>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => update(() => setEnabled(e.target.checked))}
          className="h-5 w-5 accent-primary cursor-pointer"
        />
      </label>

      {/* Node editor */}
      <div className="space-y-2">
        {nodes.map((node, i) => (
          <div
            key={node.id}
            className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground">
                Node {i + 1}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => update(() => setNodes((prev) => reorder(prev, i, -1)))}
                  disabled={i === 0}
                  className="p-1 rounded hover:bg-muted/40 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => update(() => setNodes((prev) => reorder(prev, i, 1)))}
                  disabled={i === nodes.length - 1}
                  className="p-1 rounded hover:bg-muted/40 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => update(() => setNodes((prev) => prev.filter((_, j) => j !== i)))}
                  className="p-1 rounded hover:bg-destructive/20 text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground mb-1">
                  Display title
                </label>
                <input
                  value={node.title}
                  onChange={(e) =>
                    update(() =>
                      setNodes((prev) =>
                        prev.map((n, j) => (j === i ? { ...n, title: e.target.value } : n))
                      )
                    )
                  }
                  placeholder="Music"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-chrome"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground mb-1">
                  Mobile label (optional)
                </label>
                <input
                  value={node.mobileLabel ?? ""}
                  onChange={(e) =>
                    update(() =>
                      setNodes((prev) =>
                        prev.map((n, j) =>
                          j === i ? { ...n, mobileLabel: e.target.value } : n
                        )
                      )
                    )
                  }
                  placeholder="Same as title"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-chrome"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground mb-1">
                  Route
                </label>
                <input
                  value={node.route}
                  onChange={(e) =>
                    update(() =>
                      setNodes((prev) =>
                        prev.map((n, j) => (j === i ? { ...n, route: e.target.value } : n))
                      )
                    )
                  }
                  placeholder="/music-studio"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-chrome"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-body leading-snug">
              Path like <code>/music-studio</code>, full URL like <code>https://…</code>, or in-page
              tab name like <code>Backdrops</code> / <code>Talent</code> / <code>Equipment Rental</code>.
            </p>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          className="w-full rounded-md border border-dashed border-border/60 hover:border-chrome/60 hover:bg-card/30 transition-colors px-3 py-2.5 text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add node
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
        <button
          type="button"
          onClick={handleRevert}
          disabled={!dirty || saving}
          className="chrome-btn-outline text-xs uppercase tracking-wider font-display px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <RotateCcw className="h-3 w-3" />
          Revert
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="chrome-btn text-xs uppercase tracking-wider font-display font-semibold px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Save className="h-3 w-3" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}