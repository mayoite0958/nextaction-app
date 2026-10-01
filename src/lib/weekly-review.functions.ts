import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const attachAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

export type WeeklyReview = {
  summary: string;
  wins: string[];
  concerns: string[];
  priority_adjustments: { change: string; reason: string }[];
  focus_next_week: string;
};

export const weeklyReview = createServerFn({ method: "POST" })
  .middleware([attachAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ packet: z.record(z.unknown()) }).parse(d))
  .handler(async ({ data }): Promise<WeeklyReview> => {
    const { generateWeeklyReview } = await import("./weekly-review.server");
    const text = await generateWeeklyReview(data.packet);
    const m = text.match(/\{[\s\S]*\}/);
    try {
      const j = JSON.parse(m ? m[0] : text) as Partial<WeeklyReview>;
      return {
        summary: j.summary ?? "",
        wins: j.wins ?? [],
        concerns: j.concerns ?? [],
        priority_adjustments: j.priority_adjustments ?? [],
        focus_next_week: j.focus_next_week ?? "",
      };
    } catch {
      return { summary: text, wins: [], concerns: [], priority_adjustments: [], focus_next_week: "" };
    }
  });
