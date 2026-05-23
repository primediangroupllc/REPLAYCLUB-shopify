import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SlowQuery {
  id: string;
  query_fingerprint: string;
  query_sample: string | null;
  calls: number;
  mean_exec_ms: number;
  max_exec_ms: number | null;
  captured_at: string;
}

export const AdminSlowQueries = () => {
  const [rows, setRows] = useState<SlowQuery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("query_performance_log")
        .select("*")
        .order("mean_exec_ms", { ascending: false })
        .limit(50);
      setRows((data as SlowQuery[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Slow Queries (last 50)</span>
          <Badge variant="secondary">≥ 500ms mean</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No slow queries captured yet. The nightly cron runs at 05:00 UTC.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="border border-border rounded-md p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-foreground">
                    {r.mean_exec_ms.toFixed(0)}ms mean
                    {r.max_exec_ms ? ` · ${r.max_exec_ms.toFixed(0)}ms max` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {r.calls.toLocaleString()} calls ·{" "}
                    {new Date(r.captured_at).toLocaleDateString()}
                  </span>
                </div>
                <pre className="font-mono text-muted-foreground whitespace-pre-wrap break-all">
                  {r.query_sample ?? r.query_fingerprint}
                </pre>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminSlowQueries;