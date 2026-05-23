import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function anonId(): string {
  const k = "rc_anon_id";
  let v = localStorage.getItem(k);
  if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
  return v;
}

export function useExperiment(key: string, fallback = "control"): string {
  const [variant, setVariant] = useState<string>(fallback);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: exp } = await (supabase as any).from("experiments")
          .select("id, variants, weights, status").eq("key", key).maybeSingle();
        if (!exp || exp.status !== "running" || !mounted) return;
        const variants: string[] = exp.variants ?? ["control", "variant"];
        const { data: { user } } = await supabase.auth.getUser();
        const subject = user?.id ?? anonId();
        const bucket = hash(`${key}:${subject}`) % variants.length;
        const chosen = variants[bucket];
        if (mounted) setVariant(chosen);
        await (supabase as any).from("experiment_assignments").upsert(
          { experiment_id: exp.id, experiment_key: key, subject_id: subject, variant: chosen },
          { onConflict: "experiment_id,subject_id", ignoreDuplicates: true },
        );
      } catch { /* noop */ }
    })();
    return () => { mounted = false; };
  }, [key]);

  return variant;
}