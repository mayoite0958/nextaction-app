import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type ProjectType = "finish_line" | "countable" | "ongoing";
export const PROJECT_TYPES: { value: ProjectType; label: string; hint: string }[] = [
  { value: "finish_line", label: "Finish line", hint: "Has a clear end, tracked by milestones" },
  { value: "countable", label: "Countable", hint: "A number of things to get through" },
  { value: "ongoing", label: "Ongoing", hint: "A weekly habit with no end" },
];

export type Milestone = { title: string; weight: number; done: boolean };

export function projectType(v: string | null | undefined): ProjectType {
  return v === "countable" || v === "ongoing" ? v : "finish_line";
}

export function parseMilestones(value: Json | null | undefined): Milestone[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is { [k: string]: Json } => !!m && typeof m === "object" && !Array.isArray(m))
    .map((m) => ({
      title: typeof m["title"] === "string" ? m["title"] : "",
      weight: Number.isFinite(Number(m["weight"])) ? Number(m["weight"]) : 0,
      done: m["done"] === true,
    }));
}

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Calculated progress: never guessed. */
export function computeProgress(
  p: Pick<ProjectRow, "project_type" | "milestones" | "count_done" | "count_total" | "weekly_target">,
  doneThisWeek = 0,
): number {
  const type = projectType(p.project_type);
  if (type === "finish_line") {
    return clamp(parseMilestones(p.milestones).reduce((s, m) => s + (m.done ? m.weight : 0), 0));
  }
  if (type === "countable") {
    return p.count_total ? clamp(((p.count_done ?? 0) / p.count_total) * 100) : 0;
  }
  return p.weekly_target ? clamp((doneThisWeek / p.weekly_target) * 100) : 0;
}

/** Monday 00:00 local time of the current week. */
export function weekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Done sessions this week, keyed by project_id. */
export async function fetchWeekCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("sessions")
    .select("project_id")
    .eq("status", "done")
    .gte("ended_at", weekStart().toISOString());
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const s of data ?? []) if (s.project_id) out[s.project_id] = (out[s.project_id] ?? 0) + 1;
  return out;
}
