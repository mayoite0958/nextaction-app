import { scoreProjects } from "@/lib/scoring";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { bucketLabel, daysLeft } from "@/lib/nextaction";
import { daysSince, fetchRecentSummary, parseTargets } from "@/lib/categories";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type Energy = "Low" | "Medium" | "High";

export type Recommendation = {
  project_id: string | null;
  project_name: string | null;
  next_action: string | null;
  done_looks_like: string | null;
  why: string | null;
  clarifying_question: string | null;
  task_id: string | null;
  new_task_title: string | null;
  est_minutes: number | null;
  resource_id: string | null;
};

/**
 * Call an n8n webhook with the current Supabase session's access token
 * attached as `Authorization: Bearer <token>`.
 *
 * Throws if there is no active session, so only call this from
 * signed-in surfaces (everything under _authenticated/).
 */
export async function callN8nWebhook(
  url: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("You are signed out. Sign in before requesting a next action.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (sessionError || !token) {
    throw new Error("Your session has expired. Sign in again before requesting a next action.");
  }

  const { method = "POST", body, headers = {} } = options;

  return fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** n8n webhook that receives app events (production URL). */
export const N8N_RECOMMEND_URL = "https://vidhikaindustries.app.n8n.cloud/webhook/recommend";
/** n8n webhook called when a work session ends (production URL). */
export const N8N_END_SESSION_URL =
  "https://vidhikaindustries.app.n8n.cloud/webhook/end-session";

/** n8n webhook that drafts a done definition + milestones (production URL). */
export const N8N_PLAN_PROJECT_URL =
  "https://vidhikaindustries.app.n8n.cloud/webhook/plan-project";

/** n8n webhook that classifies a saved resource (production URL). */
export const N8N_ADD_RESOURCE_URL = "https://vidhikaindustries.app.n8n.cloud/webhook/add-resource";

export type ResourceClassification = {
  title: string | null;
  resource_type: string | null;
  topic: string | null;
  problem_helped: string | null;
  summary: string | null;
  project_id: string | null;
};

/** Ask n8n to classify a link the user saved. */
export async function classifyResource(body: {
  url: string;
  note: string;
  projects: { id: string; name: string; goal: string | null }[];
}): Promise<ResourceClassification> {
  const res = await callN8nWebhook(N8N_ADD_RESOURCE_URL, { body });
  const o = await readOutput(res);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    title: str(o["title"]),
    resource_type: str(o["resource_type"]),
    topic: str(o["topic"]),
    problem_helped: str(o["problem_helped"]),
    summary: str(o["summary"]),
    project_id: str(o["project_id"]),
  };
}

export type ProjectPlan = {
  done_definition: string | null;
  milestones: { title: string; weight: number; done: boolean }[];
  first_tasks: { title: string; est_minutes: number | null; energy: string | null }[];
};

/** Ask n8n to draft a plan for a finish-line project. */
export async function planProject(body: { name: string; goal: string }): Promise<ProjectPlan> {
  const res = await callN8nWebhook(N8N_PLAN_PROJECT_URL, { body });
  const o = await readOutput(res);
  const raw = Array.isArray(o["milestones"]) ? (o["milestones"] as unknown[]) : [];
  return {
    done_definition:
      typeof o["done_definition"] === "string" && o["done_definition"].trim() ? o["done_definition"] : null,
    milestones: raw
      .map((m) => {
        if (typeof m === "string") return { title: m, weight: 0, done: false };
        const r = (m ?? {}) as Record<string, unknown>;
        const w = Number(r["weight"]);
        return { title: String(r["title"] ?? ""), weight: Number.isFinite(w) ? w : 0, done: r["done"] === true };
      })
      .filter((m) => m.title),
    first_tasks: (Array.isArray(o["first_tasks"]) ? (o["first_tasks"] as unknown[]) : [])
      .map((t) => {
        if (typeof t === "string") return { title: t.trim(), est_minutes: null, energy: null };
        const r = (t ?? {}) as Record<string, unknown>;
        const em = Number(r["est_minutes"]);
        const en = typeof r["energy"] === "string" ? r["energy"].trim() : "";
        return {
          title: String(r["title"] ?? "").trim(),
          est_minutes: Number.isFinite(em) && em > 0 ? Math.round(em) : null,
          energy: en || null,
        };
      })
      .filter((t) => t.title),
  };
}

const PROJECT_FIELDS = "*";

const minutesBetween = (a: string | null, b: string | null) =>
  a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : null;

function groupBy<T>(rows: T[], key: (r: T) => string | null, max: number): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const list = (out[k] ??= []);
    if (list.length < max) list.push(r);
  }
  return out;
}

/**
 * Ask n8n for the user's next action with a full context packet
 * (now, settings, balance, projects + tasks/sessions/notes, rejections, urgent items).
 */
export type RecommendContext = Awaited<ReturnType<typeof loadRecommendContext>>;

/** Load everything the recommend request (and the instant draft) needs. */
export async function loadRecommendContext() {
  const [{ data: settings, error: settingsError }, { data: projects, error: projectsError }] =
    await Promise.all([
      supabase.from("user_settings").select("*").maybeSingle(),
      supabase.from("projects").select(PROJECT_FIELDS).eq("status", "active"),
    ]);
  if (settingsError) throw settingsError;
  if (projectsError) throw projectsError;
  const active = (projects ?? []) as ProjectRow[];
  const ids = active.map((p) => p.id);
  const tz = settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const none = ["00000000-0000-0000-0000-000000000000"];

  const [recent_summary, tasks, sessions, notes, today, rejections, urgent, resources] = await Promise.all([
    fetchRecentSummary(settings),
    supabase
      .from("tasks")
      .select("id,project_id,title,milestone,status,est_minutes,energy,due_date")
      .in("project_id", ids.length ? ids : none)
      .in("status", ["todo", "doing"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase
      .from("sessions")
      .select("project_id,ended_at,work_started_at,recommended_action,outcome,where_stopped,right_task,less_stuck")
      .in("project_id", ids.length ? ids : none)
      .eq("status", "done")
      .order("ended_at", { ascending: false })
      .limit(300),
    supabase
      .from("project_notes")
      .select("project_id,type,text,source,created_at")
      .in("project_id", ids.length ? ids : none)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("sessions")
      .select("project_name,recommended_action,outcome,work_started_at,ended_at")
      .eq("status", "done")
      .gte("ended_at", startOfToday.toISOString())
      .order("ended_at", { ascending: true }),
    supabase
      .from("sessions")
      .select("recommended_action,project_name,created_at")
      .eq("status", "rejected")
      .gte("created_at", since14)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("urgent_items").select("*").eq("status", "open"),
    supabase
      .from("resources")
      .select("id,title,url,resource_type,topic,problem_helped,project_id")
      .eq("classified", true)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  for (const r of [tasks, sessions, notes, today, rejections, urgent, resources]) if (r.error) throw r.error;

  const tasksBy = groupBy(tasks.data ?? [], (t) => t.project_id, 8);
  const sessionsBy = groupBy(sessions.data ?? [], (t) => t.project_id, 3);
  const notesBy = groupBy(notes.data ?? [], (t) => t.project_id, 5);
  const targets = parseTargets(settings?.category_targets);
  const allTasks = tasks.data ?? [];
  const ranked = scoreProjects({
    projects: active,
    categoryOf: (p) => bucketLabel(settings, p.bucket),
    targets,
    minutes7d: Object.fromEntries(Object.entries(recent_summary).map(([k, v]) => [k, v.minutes])),
    doneSessions: sessions.data ?? [],
    openTaskCount: (id) => allTasks.filter((t) => t.project_id === id).length,
  });
  return { settings, targets, recent_summary, today, ranked, tasksBy, sessionsBy, notesBy, rejections, urgent, resources, tz, allTasks };
}

const ENERGY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

/** Instant in-app suggestion: top-scoring project + first open task that fits time and energy. */
export function draftRecommendation(ctx: RecommendContext, time_min: number, energy: Energy): Recommendation | null {
  const best = ctx.ranked.top[0] ?? ctx.ranked.others[0];
  if (!best) return null;
  const p = best.project;
  const cap = ENERGY_RANK[energy.toLowerCase()] ?? 2;
  const task = ctx.allTasks.find(
    (t) =>
      t.project_id === p.id &&
      (t.est_minutes == null || t.est_minutes <= time_min) &&
      (ENERGY_RANK[(t.energy ?? "").toLowerCase()] ?? 0) <= cap,
  );
  return {
    project_id: p.id,
    project_name: p.name,
    next_action: task?.title || p.next_likely_action || `Work on ${p.name}`,
    done_looks_like: null,
    why: best.score_reasons,
    clarifying_question: null,
    task_id: task?.id ?? null,
    new_task_title: null,
    est_minutes: null,
    resource_id: null,
  };
}

export async function requestRecommendation(
  input: { time_min: number; energy: Energy; rejected_actions: string[] },
  ctxIn?: RecommendContext,
): Promise<Recommendation> {
  const { settings, targets, recent_summary, today, ranked, tasksBy, sessionsBy, notesBy, rejections, urgent, resources, tz } =
    ctxIn ?? (await loadRecommendContext());
  const now = new Date();
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...o }).format(now);

  const res = await callN8nWebhook(N8N_RECOMMEND_URL, {
    body: {
      mode: "C",
      now: {
        date: fmt({ year: "numeric", month: "2-digit", day: "2-digit" }),
        weekday: new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(now),
        local_time: fmt({ hour: "2-digit", minute: "2-digit", hour12: false }),
        timezone: tz,
        time_min: input.time_min,
        energy: input.energy,
      },
      time_min: input.time_min,
      energy: input.energy,
      rejected_actions: input.rejected_actions,
      settings: settings ?? null,
      category_targets: targets,
      balance: {
        last_7_days: Object.fromEntries(
          Object.entries(recent_summary).map(([k, v]) => [k, { minutes: v.minutes, sessions: v.count }]),
        ),
        today: (today.data ?? []).map((s) => ({
          project: s.project_name,
          action: s.recommended_action,
          outcome: s.outcome,
          minutes: minutesBetween(s.work_started_at, s.ended_at),
        })),
      },
      top_projects: ranked.top.map(({ project: p, category, score, score_reasons }) => ({
        ...p,
        category,
        score,
        score_reasons,
        days_since_worked: daysSince(p.last_worked_at),
        days_to_deadline: daysLeft(p.deadline),
        open_tasks: tasksBy[p.id] ?? [],
        recent_sessions: (sessionsBy[p.id] ?? []).map((s) => ({
          date: s.ended_at,
          action: s.recommended_action,
          outcome: s.outcome,
          where_stopped: s.where_stopped,
          right_task: s.right_task,
          less_stuck: s.less_stuck,
          minutes_worked: minutesBetween(s.work_started_at, s.ended_at),
        })),
        notes: notesBy[p.id] ?? [],
      })),
      other_projects: ranked.others.map(({ project: p, category, score }) =>
        `${p.name} (${category}, id ${p.id}, score ${score}): ${p.progress_percent ?? 0}% done` +
        (p.deadline ? `, due ${p.deadline}` : "") +
        (p.next_likely_action ? `, next: ${p.next_likely_action}` : ""),
      ),
      rejections: (rejections.data ?? []).map((r) => ({
        action: r.recommended_action,
        project_name: r.project_name,
        at: r.created_at,
      })),
      urgent_items: urgent.data ?? [],
      resources: resources.data ?? [],
    },
  });

  const output = await readOutput(res);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const est = Number(output["est_minutes"]);
  return {
    project_id: str(output["project_id"]),
    project_name: str(output["project_name"]),
    next_action: str(output["next_action"]),
    done_looks_like: str(output["done_looks_like"]),
    why: str(output["why"]),
    clarifying_question: str(output["clarifying_question"]),
    task_id: str(output["task_id"]),
    new_task_title: str(output["new_task_title"]),
    resource_id: str(output["resource_id"]),
    est_minutes: output["est_minutes"] != null && Number.isFinite(est) && est > 0 ? Math.round(est) : null,
  };
}

export type SessionEndOutput = {
  progress_percent: number | null;
  progress_summary: string | null;
  last_meaningful_action: string | null;
  next_likely_action: string | null;
  blocker: string | null;
  next_move: string | null;
  milestone_suggestions: string[];
  notes: string[];
  new_tasks: { title: string; est_minutes: number | null }[];
  task_done: boolean;
};

/** Tell n8n a session ended and return its parsed output. */
export async function reportSessionEnd(body: {
  project: ProjectRow | null;
  action: string | null;
  outcome: string;
  where_stopped: string;
  events: { type: string | null; text: string | null; time: string | null }[];
  focus?: { minutes_on_task: number; checkins: number; switches: number; detours?: number; away_minutes: number };
}): Promise<SessionEndOutput> {
  const res = await callN8nWebhook(N8N_END_SESSION_URL, { body });
  const o = await readOutput(res);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const n = Number(o["progress_percent"]);
  return {
    progress_percent:
      o["progress_percent"] != null && Number.isFinite(n)
        ? Math.min(100, Math.max(0, Math.round(n)))
        : null,
    progress_summary: str(o["progress_summary"]),
    last_meaningful_action: str(o["last_meaningful_action"]),
    next_likely_action: str(o["next_likely_action"]),
    blocker: str(o["blocker"]),
    next_move: str(o["next_move"]),
    milestone_suggestions: Array.isArray(o["milestone_suggestions"])
      ? (o["milestone_suggestions"] as unknown[])
          .map((m) =>
            typeof m === "string" ? m : m && typeof m === "object" ? String((m as { title?: unknown }).title ?? "") : String(m),
          )
          .filter(Boolean)
      : [],
    notes: Array.isArray(o["notes"])
      ? (o["notes"] as unknown[]).map((n) => String(n ?? "").trim()).filter(Boolean)
      : [],
    new_tasks: Array.isArray(o["new_tasks"])
      ? (o["new_tasks"] as unknown[])
          .map((t) => {
            if (typeof t === "string") return { title: t.trim(), est_minutes: null };
            const r = (t ?? {}) as Record<string, unknown>;
            const em = Number(r["est_minutes"]);
            return {
              title: String(r["title"] ?? "").trim(),
              est_minutes: Number.isFinite(em) && em > 0 ? Math.round(em) : null,
            };
          })
          .filter((t) => t.title)
      : [],
    task_done: o["task_done"] === true,
  };
}

async function readOutput(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!res.ok) throw new Error(`n8n replied ${res.status}: ${text.slice(0, 200)}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("n8n did not reply with JSON.");
  }
  const root = Array.isArray(parsed) ? parsed[0] : parsed;
  const output = (root as { output?: Record<string, unknown> } | null)?.output;
  if (!output || typeof output !== "object") throw new Error("n8n's reply had no output object.");
  return output;
}
