import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface Metric { function_name: string; total_calls: number; error_4xx: number; error_5xx: number; metric_date: string; }

export function AdminErrorBudget() {
  const [rows, setRows] = useState<Metric[]>([]);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
      const { data } = await (supabase as any).from("edge_function_metrics")
        .select("*").gte("metric_date", since).order("metric_date", { ascending: false });
      setRows((data ?? []) as Metric[]);
    })();
  }, []);

  const aggregated = rows.reduce<Record<string, { calls: number; e4: number; e5: number }>>((acc, r) => {
    const k = r.function_name;
    if (!acc[k]) acc[k] = { calls: 0, e4: 0, e5: 0 };
    acc[k].calls += r.total_calls; acc[k].e4 += r.error_4xx; acc[k].e5 += r.error_5xx;
    return acc;
  }, {});
  const list = Object.entries(aggregated).sort((a, b) => (b[1].e5 + b[1].e4) - (a[1].e5 + a[1].e4));

  const breaching = list.filter(([, m]) => {
    if (m.calls < 20) return false; // ignore low-volume noise
    const pct = ((m.e4 + m.e5) / m.calls) * 100;
    return pct > 5;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          Edge Function Error Budget (7d)
          {breaching.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> {breaching.length} function{breaching.length === 1 ? "" : "s"} over 5%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No metrics yet. The nightly aggregator will populate this.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>4xx</TableHead>
                <TableHead>5xx</TableHead>
                <TableHead>Error %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(([name, m]) => {
                const pct = m.calls > 0 ? ((m.e4 + m.e5) / m.calls) * 100 : 0;
                return (
                  <TableRow key={name}>
                    <TableCell className="font-mono text-xs">{name}</TableCell>
                    <TableCell>{m.calls}</TableCell>
                    <TableCell>{m.e4}</TableCell>
                    <TableCell>{m.e5}</TableCell>
                    <TableCell>
                      <Badge variant={pct > 5 ? "destructive" : pct > 1 ? "secondary" : "default"}>
                        {pct.toFixed(2)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}