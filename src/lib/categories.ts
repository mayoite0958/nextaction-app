import { supabase } from "@/integrations/supabase/client";
import { bucketLabel } from "@/lib/nextaction";
import type { Json } from "@/integrations/supabase/types";

type LabelSettings = {
  bucket_urgent_label?: string | null;
  bucket_longterm_label?: string | null;
} | null | undefined;

/** Parse user_settings.category_targets into { label: percent }. */
export function parseTargets(value: Json | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  return out;
}

export type CategorySummary = Record<string, { count: number; minutes: number }>;

/** Done sessions in the last 7 days, grouped by the project's category name. */
export async function fetchRecentSummary(settings: LabelSettings): Promise<CategorySummary> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .select("work_started_at, ended_at, created_at, projects(bucket)")
    .eq("status", "done")
    .gte("ended_at", since);
  if (error) throw error;
  const summary: CategorySummary = {};
  for (const s of data ?? []) {
    const proj = s.projects as { bucket: string | null } | null;
    const label = bucketLabel(settings, proj?.bucket ?? null);
    const start = s.work_started_at ?? s.created_at;
    const mins =
      start && s.ended_at
        ? Math.max(0, Math.round((new Date(s.ended_at).getTime() - new Date(start).getTime()) / 60000))
        : 0;
    const entry = (summary[label] ??= { count: 0, minutes: 0 });
    entry.count += 1;
    entry.minutes += mins;
  }
  return summary;
}

export function daysSince(value: string | null): number | null {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}
