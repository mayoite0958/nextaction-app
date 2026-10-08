import type { Database } from "@/integrations/supabase/types";
import { daysLeft } from "@/lib/nextaction";
import { daysSince } from "@/lib/categories";
import { weekStart } from "@/lib/progress";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type Scored = { project: ProjectRow; category: string; score: number; score_reasons: string };

/**
 * Score active projects for the recommend request and split them into
 * top_projects (best per targeted category + 2 best remaining) and the rest.
 */
export function scoreProjects(args: {
  projects: ProjectRow[];
  categoryOf: (p: ProjectRow) => string;
  targets: Record<string, number>;
  minutes7d: Record<string, number>;
  doneSessions: { project_id: string | null; ended_at: string | null; work_started_at?: string | null }[];
  openTaskCount: (id: string) => number;
  now?: Date;
}): { top: Scored[]; others: Scored[] } {
  const now = args.now ?? new Date();
  const totalMin = Object.values(args.minutes7d).reduce((a, b) => a + b, 0);
  const actual = (c: string) => (totalMin ? Math.round(((args.minutes7d[c] ?? 0) / totalMin) * 100) : 0);
  const catOfId = new Map(args.projects.map((p) => [p.id, args.categoryOf(p)]));
  const lastByCat: Record<string, string> = {};
  const weekCount: Record<string, number> = {};
  const ws = weekStart().getTime();
  for (const s of args.doneSessions) {
    if (!s.project_id || !s.ended_at) continue;
    const c = catOfId.get(s.project_id);
    if (c && (!lastByCat[c] || s.ended_at > lastByCat[c]!)) lastByCat[c] = s.ended_at;
    if (new Date(s.ended_at).getTime() >= ws && countsAsWork(s)) weekCount[s.project_id] = (weekCount[s.project_id] ?? 0) + 1;
  }
  const lateWeek = [5, 6, 0].includes(now.getDay());

  const scored: Scored[] = args.projects.map((p) => {
    const cat = args.categoryOf(p);
    const target = args.targets[cat] ?? 0;
    const act = actual(cat);
    let score = 0;
    const why: string[] = [];
    const dl = daysLeft(p.deadline);
    if (dl != null && dl <= 2) { score += 50; why.push(`deadline in ${dl} days`); }
    else if (dl != null && dl <= 7) { score += 25; why.push(`deadline in ${dl} days`); }
    const gap = target - act;
    if (gap !== 0) score += 2 * gap;
    why.push(`${act}% vs ${target}% target`);
    score += 5 * (p.value_score ?? 3);
    if ((p.progress_percent ?? 0) >= 75) { score += 10; why.push(`${p.progress_percent}% done`); }
    const since = daysSince(p.last_worked_at);
    if (since == null || since >= 7) { score += 10; why.push(since == null ? "never worked on" : `not worked on in ${since} days`); }
    if (p.blocker && args.openTaskCount(p.id) === 0) { score -= 15; why.push("blocked, no open tasks"); }
    const last = lastByCat[cat];
    const lastDays = last ? daysSince(last) : null;
    if (lastDays == null || lastDays >= 7) {
      score += 30;
      why.unshift(lastDays == null ? "no session in 7+ days" : `no session in ${lastDays} days`);
      if (target > 0 && act < target / 2) score += 15;
    }
    if (p.project_type === "ongoing" && p.weekly_target) {
      const missing = p.weekly_target - (weekCount[p.id] ?? 0);
      if (missing > 0) {
        score += missing * 10 * (lateWeek ? 2 : 1);
        why.push(`${missing} habit session${missing > 1 ? "s" : ""} short this week`);
      }
    }
    return { project: p, category: cat, score, score_reasons: `${cat}: ${why.join("; ")}` };
  });

  scored.sort((a, b) => b.score - a.score);
  const top: Scored[] = [];
  const cats = Object.entries(args.targets).filter(([, t]) => t > 0).map(([c]) => c);
  for (const c of cats) {
    const best = scored.find((s) => s.category === c);
    if (best) top.push(best);
  }
  top.push(...scored.filter((s) => !top.includes(s)).slice(0, 2));
  top.sort((a, b) => b.score - a.score);
  return { top, others: scored.filter((s) => !top.includes(s)) };
}
