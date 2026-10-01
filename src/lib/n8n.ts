import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

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
export const N8N_RECOMMEND_URL = "https://kaalpanikkala.app.n8n.cloud/webhook-test/recommend";

const PROJECT_FIELDS =
  "id,name,goal,deadline,bucket,value_score,progress_summary,blocker,last_meaningful_action,next_likely_action,last_worked_at";

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
>;

/**
 * Ask n8n for the user's next action. Sends mode "C" with the user's
 * settings, active projects, available time, energy, and any actions
 * they already rejected. Returns n8n's parsed recommendation.
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

  const res = await callN8nWebhook(N8N_RECOMMEND_URL, {
    body: {
      mode: "C",
      time_min: input.time_min,
      energy: input.energy,
      rejected_actions: input.rejected_actions,
      settings: settings ?? null,
      projects: (projects ?? []) as ProjectSlice[],
    },
  });

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
  if (!output || typeof output !== "object") {
    throw new Error("n8n's reply had no output object.");
  }

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
