import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type P = { id: string; name: string; next_likely_action: string | null };

/** "Welcome back" recap built from saved sessions and tasks only (no AI). */
export function RestartCard({ project, onClose }: { project: P; onClose?: () => void }) {
  const q = useQuery({
    queryKey: ["restart", project.id],
    queryFn: async () => {
      const [s, t] = await Promise.all([
        supabase
          .from("sessions")
          .select("recommended_action,outcome,where_stopped,ended_at")
          .eq("project_id", project.id)
          .eq("status", "done")
          .order("ended_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("tasks")
          .select("title,status,created_at")
          .eq("project_id", project.id)
          .in("status", ["doing", "todo"])
          .order("status", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      if (s.error) throw s.error;
      if (t.error) throw t.error;
      return { last: s.data, task: t.data };
    },
  });
  if (!q.data) return null;
  const { last, task } = q.data;
  const startWith = task?.title || project.next_likely_action;
  const stopped = last?.where_stopped || project.next_likely_action;
  return (
    <div className="rec-in relative overflow-hidden rounded-xl border border-longterm/50 bg-longterm/10 p-4">
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close recap" className="absolute right-2 top-2 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
          ×
        </button>
      )}
      <p className="pr-8 font-display text-base font-semibold leading-snug">
        Welcome back to {project.name} 👋
      </p>
      <dl className="mt-3 space-y-2 text-sm leading-relaxed">
        <div>
          <dt className="inline text-muted-foreground">Last time: </dt>
          <dd className="inline">
            {last?.recommended_action ? `${last.recommended_action}${last.outcome ? ` (${last.outcome})` : ""}` : "no finished session yet"}
          </dd>
        </div>
        {stopped && (
          <div>
            <dt className="inline text-muted-foreground">You stopped at: </dt>
            <dd className="inline">{stopped}</dd>
          </div>
        )}
        {startWith && (
          <div className="rounded-lg bg-background/60 p-3">
            <dt className="text-xs uppercase tracking-widest text-primary">Start with (2 minutes)</dt>
            <dd className="mt-1 font-medium">{startWith}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
