import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Returns the active project names for the account that owns a capture key (used by /share).
const Body = z.object({ key: z.string().min(8).max(200) });

export const Route = createFileRoute("/api/public/share-projects")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owner } = await supabaseAdmin
          .from("user_settings")
          .select("user_id")
          .eq("capture_key", parsed.data.key)
          .maybeSingle();
        if (!owner?.user_id) return Response.json({ error: "Unknown key" }, { status: 404 });
        const { data, error } = await supabaseAdmin
          .from("projects")
          .select("id,name")
          .eq("user_id", owner.user_id)
          .eq("status", "active")
          .order("name");
        if (error) return Response.json({ error: "Could not load projects" }, { status: 500 });
        return Response.json({ projects: data ?? [] });
      },
    },
  },
});
