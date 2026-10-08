import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { matchResources } from "@/lib/n8n";
import { openExternal } from "@/lib/open-external";
import { youtubeThumb } from "@/lib/youtube";

type Res = { id: string; title: string | null; url: string | null; resource_type: string | null; topic: string | null; problem_helped: string | null; project_id: string | null };
type Trigger = "session_start" | "step_done" | "stuck";

/** "Handy for this task": asks n8n for matching saved resources at session start, after Done step, and on Stuck. */
export function HandyPanel({ sessionId, projectId, action, trigger, events }: {
  sessionId: string;
  projectId: string | null;
  action: string;
  /** Changes every time a new lookup should run. */
  trigger: { kind: Trigger; n: number };
  events: { type: string | null; text: string | null }[];
}) {
  const [items, setItems] = useState<(Res & { why: string | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const my = ++seq.current;
    setLoading(true);
    void (async () => {
      try {
        // Only offer resources saved to THIS project, or not tied to any project.
        let query = supabase
          .from("resources")
          .select("id,title,url,resource_type,topic,problem_helped,project_id")
          .order("created_at", { ascending: false })
          .limit(100);
        if (projectId) query = query.or(`project_id.eq.${projectId},project_id.is.null`);
        const { data } = await query;
        const all = ((data ?? []) as Res[]).filter((r) => !projectId || !r.project_id || r.project_id === projectId);
        if (!all.length) { if (my === seq.current) setItems([]); return; }
        const matches = await matchResources({
          trigger: trigger.kind,
          session_id: sessionId,
          project_id: projectId,
          action,
          recent_events: eventsRef.current.slice(-10),
          resources: all.map(({ url: _u, ...r }) => r),
        });
        if (my !== seq.current) return;
        const byId = new Map(all.map((r) => [r.id, r]));
        setItems(matches.flatMap((m) => { const r = byId.get(m.id); return r ? [{ ...r, why: m.why }] : []; }).slice(0, 3));
      } catch {
        /* keep the previous suggestions if the lookup fails */
      } finally {
        if (my === seq.current) setLoading(false);
      }
    })();
  }, [trigger.n, trigger.kind, sessionId, projectId, action]);

  if (!loading && items.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Handy for this task{trigger.kind === "stuck" ? " · for getting unstuck" : ""}
      </p>
      {loading && items.length === 0 && <div className="h-10 animate-pulse rounded bg-muted" />}
      <ul className="space-y-2">
        {items.map((r) => {
          const thumb = youtubeThumb(r.url);
          return (
            <li key={r.id}>
              <button
                type="button"
                disabled={!r.url}
                onClick={() => r.url && openExternal(r.url)}
                className="flex w-full min-w-0 items-center gap-3 rounded-md p-1 text-left hover:bg-muted disabled:opacity-60"
              >
                {thumb ? (
                  <img src={thumb} alt="" className="aspect-video w-20 shrink-0 rounded object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-muted">🔗</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title || r.url || "Saved resource"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.why || r.problem_helped || r.resource_type || ""}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {loading && items.length > 0 && <p className="text-xs text-muted-foreground">Updating…</p>}
    </div>
  );
}
