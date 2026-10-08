import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { openExternal } from "@/lib/open-external";

type P = { id: string; name: string; next_likely_action: string | null; blocker?: string | null };

const outcomeLabel = (o: string | null) => (o === "Materially advanced" ? "Made progress" : o);
const dismissKey = (id: string) => `na_restart_dismissed_${id}`;

function nextMoveOf(pending: unknown): string | null {
  if (pending && typeof pending === "object" && !Array.isArray(pending)) {
    const v = (pending as Record<string, unknown>)["next_move"];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** "Welcome back" recap built from saved sessions, tasks and resources only (no AI). */
export function RestartCard({ project, onClose }: { project: P; onClose?: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (onClose) return;
    try { setDismissed(sessionStorage.getItem(dismissKey(project.id)) === "1"); } catch { /* ignore */ }
  }, [project.id, onClose]);

  const q = useQuery({
    queryKey: ["restart", project.id],
    queryFn: async () => {
      const [s, t, r] = await Promise.all([
        supabase
          .from("sessions")
          .select("recommended_action,outcome,where_stopped,ended_at,pending_update")
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
        supabase
          .from("resources")
          .select("id,title,url,created_at")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (s.error) throw s.error;
      if (t.error) throw t.error;
      return { last: s.data, task: t.data, resource: r.data };
    },
  });

  if (!q.data || dismissed) return null;
  const { last, task, resource } = q.data;
  const startWith = task?.title || project.next_likely_action;
  const stopped = last?.where_stopped || nextMoveOf(last?.pending_update) || project.next_likely_action;
  const first = !last;
  const date = last?.ended_at
    ? new Date(last.ended_at).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
    : null;
  const savedDays = resource?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(resource.created_at).getTime()) / 86400000))
    : null;

  function close() {
    if (onClose) { onClose(); return; }
    try { sessionStorage.setItem(dismissKey(project.id), "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="rec-in relative overflow-hidden rounded-xl border border-longterm/50 bg-longterm/10 p-4">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left font-display text-base font-semibold leading-snug"
        >
          {first ? `First time on ${project.name} 🚀` : `Welcome back to ${project.name} 👋`}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{open ? "Hide" : "Show"}</span>
        </button>
        <button type="button" onClick={close} aria-label="Dismiss recap" className="-mr-1 -mt-1 h-8 w-8 shrink-0 rounded-full text-lg text-muted-foreground hover:text-foreground">
          ×
        </button>
      </div>
      {open && (
        <dl className="mt-3 space-y-2 text-sm leading-relaxed">
          {!first && (
            <div>
              <dt className="inline text-muted-foreground">Last time: </dt>
              <dd className="inline">
                {last.recommended_action || "a session"}
                {(last.outcome || date) && ` (${[outcomeLabel(last.outcome), date].filter(Boolean).join(", ")})`}
              </dd>
            </div>
          )}
          {!first && stopped && (
            <div>
              <dt className="inline text-muted-foreground">You stopped at: </dt>
              <dd className="inline">{stopped}</dd>
            </div>
          )}
          {project.blocker?.trim() && (
            <div>
              <dt className="inline text-muted-foreground">Blocker: </dt>
              <dd className="inline">{project.blocker}</dd>
            </div>
          )}
          {startWith && (
            <div className="rounded-lg bg-background/60 p-3">
              <dt className="text-xs uppercase tracking-widest text-primary">Start with · 2 minutes</dt>
              <dd className="mt-1 font-medium">{startWith}</dd>
            </div>
          )}
          {resource && (
            <div className="flex items-center gap-2 border-t border-border/60 pt-2">
              <dd className="min-w-0 flex-1">
                📚 You saved this {savedDays === 0 ? "today" : `${savedDays} day${savedDays === 1 ? "" : "s"} ago`}:{" "}
                <span className="font-medium">{resource.title || resource.url || "a resource"}</span>
              </dd>
              {resource.url && (
                <button type="button" onClick={() => openExternal(resource.url!)} className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-primary">
                  Open
                </button>
              )}
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
