import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (error || !token) {
    throw new Error("No active session — cannot call n8n webhook");
  }

  const { method = "POST", body, headers = {} } = options;

  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** n8n webhook that receives app events. Swap to the Production URL when live. */
export const N8N_RECOMMEND_URL = "https://kaalpanikkala.app.n8n.cloud/webhook-test/recommend";

export type N8nEvent = "onboarding_completed" | "today_opened" | "next_action_requested" | "settings_saved";

/** Load the user's settings + active projects and send them to n8n. Returns n8n's reply as text. */
export async function sendToN8n(event: N8nEvent): Promise<string> {
  const [{ data: userData }, { data: settings }, { data: projects }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.from("projects").select("*").eq("status", "active"),
  ]);
  const res = await callN8nWebhook(N8N_RECOMMEND_URL, {
    body: {
      event,
      sent_at: new Date().toISOString(),
      user_id: userData.user?.id ?? null,
      email: userData.user?.email ?? null,
      settings,
      projects: projects ?? [],
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`n8n replied ${res.status}: ${text.slice(0, 200)}`);
  try {
    const json = JSON.parse(text);
    const pick = Array.isArray(json) ? json[0] : json;
    if (typeof pick === "string") return pick;
    const msg = pick?.recommendation ?? pick?.next_action ?? pick?.message ?? pick?.output ?? pick?.text;
    return typeof msg === "string" ? msg : JSON.stringify(json, null, 2);
  } catch {
    return text;
  }
}
