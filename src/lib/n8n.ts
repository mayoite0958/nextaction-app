import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { daysSince, fetchRecentSummary, parseTargets } from "@/lib/categories";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectSlice = Pick<
  ProjectRow,
  | "id"
  | "name"
  | "goal"
  | "deadline"
  | "bucket"
  | "value_score"
  | "progress_summary"
  | "blocker"
  | "last_meaningful_action"
  | "next_likely_action"
  | "last_worked_at"
  | "progress_percent"
  | "project_type"
  | "done_definition"
  | "milestones"
  | "count_total"
  | "count_done"
  | "weekly_target"
>;

export type Energy = "Low" | "Medium" | "High";

export type Recommendation = {
  project_id: string | null;
  project_name: string | null;
  next_action: string | null;
  done_looks_like: string | null;
  why: string | null;
  clarifying_question: string | null;
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

/** n8n webhook that receives app events. Swap to the Production URL when live. */
export const N8N_RECOMMEND_URL = "https://vidhikaindustries.app.n8n.cloud/webhook-test/recommend";
/** n8n webhook called when a work session ends. */
export const N8N_END_SESSION_URL =
  "https://vidhikaindustries.app.n8n.cloud/webhook-test/end-session";

/** n8n webhook that drafts a done definition + milestones. Placeholder until the real URL is supplied. */
export const N8N_PLAN_PROJECT_URL =
  "https://vidhikaindustries.app.n8n.cloud/webhook-test/plan-project";

export type ProjectPlan = {
  done_definition: string | null;
  milestones: { title: string; weight: number; done: boolean }[];
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
  };
}

const PROJECT_FIELDS =
  "id,name,goal,deadline,bucket,value_score,progress_summary,blocker,last_meaningful_action,next_likely_action,last_worked_at,progress_percent,project_type,done_definition,milestones,count_total,count_done,weekly_target";

/**
 * Ask n8n for the user's next action. Sends mode "C" with settings,
 * active projects, category targets, a 7-day summary, time, energy and
 * rejected actions. Returns n8n's parsed recommendation.
 */
export async function requestRecommendation(input: {
  time_min: number;
  energy: Energy;
  rejected_actions: string[];
}): Promise<Recommendation> {
  const [{ data: settings, error: settingsError }, { data: projects, error: projectsError }] =
    await Promise.all([
      supabase.from("user_settings").select("*").maybeSingle(),
      supabase.from("projects").select(PROJECT_FIELDS).eq("status", "active"),
    ]);
  if (settingsError) throw settingsError;
  if (projectsError) throw projectsError;
  const recent_summary = await fetchRecentSummary(settings);

  const res = await callN8nWebhook(N8N_RECOMMEND_URL, {
    body: {
      mode: "C",
      time_min: input.time_min,
      energy: input.energy,
      rejected_actions: input.rejected_actions,
      settings: settings ?? null,
      category_targets: parseTargets(settings?.category_targets),
      recent_summary,
      projects: ((projects ?? []) as ProjectSlice[]).map((p) => ({
        ...p,
        progress_percent: p.progress_percent ?? null,
        days_since_worked: daysSince(p.last_worked_at),
      })),
    },
  });

  const output = await readOutput(res);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    project_id: str(output["project_id"]),
    project_name: str(output["project_name"]),
    next_action: str(output["next_action"]),
    done_looks_like: str(output["done_looks_like"]),
    why: str(output["why"]),
    clarifying_question: str(output["clarifying_question"]),
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
};

/** Tell n8n a session ended and return its parsed output. */
export async function reportSessionEnd(body: {
  project: ProjectRow | null;
  action: string | null;
  outcome: string;
  where_stopped: string;
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
