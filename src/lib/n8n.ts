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
