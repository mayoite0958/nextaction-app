import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { weeklyReview, type WeeklyReview as Review } from "@/lib/weekly-review.functions";

export function WeeklyReview({ projectId }: { projectId: string }) {
  const run = useServerFn(weeklyReview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [counts, setCounts] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const [project, sessions, notes, tasks, settings] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("sessions").select("*").eq("project_id", projectId).gte("created_at", since).order("created_at", { ascending: false }).limit(40),
        supabase.from("project_notes").select("*").eq("project_id", projectId).gte("created_at", since).order("created_at", { ascending: false }).limit(30),
        supabase.from("tasks").select("*").eq("project_id", projectId).limit(60),
        supabase.from("user_settings").select("*").maybeSingle(),
      ]);
      const err = project.error ?? sessions.error ?? notes.error ?? tasks.error;
      if (err) throw err;
      const s = sessions.data ?? [];
      setCounts(`${s.filter((x) => x.status === "done").length} sessions · ${notes.data?.length ?? 0} notes · ${tasks.data?.length ?? 0} tasks`);
      const out = await run({
        data: {
          packet: {
            today: new Date().toISOString().slice(0, 10),
            project: project.data,
            milestones: project.data?.milestones ?? [],
            sessions_last_7_days: s,
            notes_last_7_days: notes.data ?? [],
            tasks: tasks.data ?? [],
            settings: settings.data,
          },
        },
      });
      setReview(out);
    } catch (e) {
      console.error("weekly review failed", e);
      const msg =
        e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
      setError(msg ? `Couldn't generate the summary: ${msg}` : "Couldn't generate the summary.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel mt-6 space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Weekly review</h2>
          <p className="text-sm text-muted-foreground">AI summary of the last 7 days, with priority suggestions.</p>
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? "Reviewing…" : review ? "Regenerate" : "Generate summary"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {counts && <p className="text-xs text-muted-foreground">Based on {counts}</p>}
      {review && (
        <div className="space-y-4 text-sm">
          <p>{review.summary}</p>
          <List title="Wins" items={review.wins} />
          <List title="Concerns" items={review.concerns} />
          {review.priority_adjustments.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-primary">Suggested priority adjustments</h3>
              <ul className="space-y-2">
                {review.priority_adjustments.map((a, i) => (
                  <li key={i}>
                    <span className="font-medium">{a.change}</span>
                    <span className="block text-muted-foreground">{a.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.focus_next_week && (
            <p><span className="font-medium">Focus next week:</span> {review.focus_next_week}</p>
          )}
        </div>
      )}
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1 font-medium">{title}</h3>
      <ul className="list-disc space-y-1 pl-5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}
