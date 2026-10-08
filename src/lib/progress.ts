import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

/** Sessions shorter than this don't count toward habit progress or the balance box. */
export const MIN_COUNTED_SEC = 120;
export function countsAsWork(s: { work_started_at?: string | null; created_at?: string | null; ended_at: string | null }) {
  const start = s.work_started_at ?? s.created_at;
  if (!start || !s.ended_at) return false;
  return new Date(s.ended_at).getTime() - new Date(start).getTime() >= MIN_COUNTED_SEC * 1000;
}

/** Done sessions this week (2+ minutes) for one project. */
export async function fetchProjectWeekCount(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from("sessions")
    .select("work_started_at,created_at,ended_at")
    .eq("project_id", projectId)
    .eq("status", "done")
    .gte("ended_at", weekStart().toISOString());
  if (error) throw error;
  return (data ?? []).filter(countsAsWork).length;
}

/** Mark a project as worked on now (every project type). */
export async function touchProjectWorked(projectId: string | null | undefined) {
  if (!projectId) return;
  await supabase.from("projects").update({ last_worked_at: new Date().toISOString() }).eq("id", projectId);
}

export type ProjectType = "finish_line" | "countable" | "ongoing";
export const PROJECT_TYPES: { value: ProjectType; label: string; hint: string }[] = [
  { value: "finish_line", label: "Has an end goal", hint: "Finishes when a goal is reached, tracked by milestones" },
  { value: "countable", label: "Has a number of parts", hint: "A set count of pieces to get through" },
  { value: "ongoing", label: "Habit", hint: "Something you repeat each week" },
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
  tasks: TaskLite[] = [],
): number {
  const type = projectType(p.project_type);
  if (type === "finish_line") return finishLineProgress(parseMilestones(p.milestones), tasks);
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
    .select("project_id,work_started_at,created_at,ended_at")
    .eq("status", "done")
    .gte("ended_at", weekStart().toISOString());
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const s of (data ?? []).filter(countsAsWork)) if (s.project_id) out[s.project_id] = (out[s.project_id] ?? 0) + 1;
  return out;
}

export type TaskLite = { status: string | null; milestone: string | null };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Finish-line progress: done milestones count fully; ticked tasks fill in
 * the milestone they belong to. Tasks with no milestone share the weight of
 * unfinished milestones that have no tasks of their own. With no milestones,
 * progress is simply done tasks / all tasks.
 */
function finishLineProgress(milestones: Milestone[], allTasks: TaskLite[]): number {
  const tasks = allTasks.filter((t) => t.status !== "dropped");
  const frac = (ts: TaskLite[]) => (ts.length ? ts.filter((t) => t.status === "done").length / ts.length : 0);
  const ms = milestones.filter((m) => m.title.trim());
  if (!ms.length) return clamp(frac(tasks) * 100);
  const titles = new Set(ms.map((m) => norm(m.title)));
  const loose = tasks.filter((t) => !titles.has(norm(t.milestone)));
  let total = 0;
  let looseWeight = 0;
  for (const m of ms) {
    if (m.done) { total += m.weight; continue; }
    const own = tasks.filter((t) => norm(t.milestone) === norm(m.title));
    if (own.length) total += m.weight * frac(own);
    else looseWeight += m.weight;
  }
  total += looseWeight * frac(loose);
  return clamp(total);
}

/** Recalculate and save a project's progress (e.g. after ticking a task). */
export async function recalcProjectProgress(projectId: string): Promise<number | null> {
  const [{ data: p }, { data: tasks }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("tasks").select("status,milestone").eq("project_id", projectId),
  ]);
  if (!p) return null;
  let week = 0;
  if (projectType(p.project_type) === "ongoing") week = (await fetchWeekCounts())[projectId] ?? 0;
  const pct = computeProgress(p, week, tasks ?? []);
  if (pct !== p.progress_percent) await supabase.from("projects").update({ progress_percent: pct }).eq("id", projectId);
  return pct;
}
