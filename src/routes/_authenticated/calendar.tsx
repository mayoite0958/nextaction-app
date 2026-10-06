import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { bucketLabel } from "@/lib/nextaction";
import { parseTargets } from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Next Action" },
      { name: "description", content: "Deadlines, done sessions and tasks by day and week." },
      { property: "og:title", content: "Calendar — Next Action" },
      { property: "og:description", content: "Deadlines, done sessions and tasks by day and week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const mondayOf = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return addDays(x, -((x.getDay() + 6) % 7));
};

type Sess = {
  id: string;
  project_name: string | null;
  recommended_action: string | null;
  outcome: string | null;
  where_stopped: string | null;
  right_task: number | null;
  less_stuck: number | null;
  milestone_moved: boolean | null;
  minutes: number;
  category: string;
};
type Item = { id: string; title: string; sub?: string };
type Day = { sessions: Sess[]; deadlines: Item[]; tasks: Item[] };

function CalendarPage() {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => {
    if (view === "week") {
      const s = mondayOf(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const s = mondayOf(first);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const n = Math.ceil(((last.getTime() - s.getTime()) / 86400000 + 1) / 7) * 7;
    return Array.from({ length: n }, (_, i) => addDays(s, i));
  }, [view, cursor]);
  const from = days[0];
  const to = addDays(days[days.length - 1], 1);

  const settingsQ = useQuery({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const settings = settingsQ.data;

  const dataQ = useQuery({
    queryKey: ["calendar", key(from), key(to)],
    queryFn: async () => {
      const [s, p, u, t] = await Promise.all([
        supabase
          .from("sessions")
          .select("id,project_name,recommended_action,outcome,where_stopped,right_task,less_stuck,milestone_moved,work_started_at,created_at,ended_at,projects(name,bucket)")
          .eq("status", "done")
          .gte("ended_at", from.toISOString())
          .lt("ended_at", to.toISOString()),
        supabase.from("projects").select("id,name,deadline,bucket,status").gte("deadline", key(from)).lt("deadline", key(to)),
        supabase.from("urgent_items").select("id,company,required_action,deadline,status").gte("deadline", key(from)).lt("deadline", key(to)),
        supabase.from("tasks").select("id,title,status,due_date,projects(name)").gte("due_date", key(from)).lt("due_date", key(to)),
      ]);
      for (const r of [s, p, u, t]) if (r.error) throw r.error;
      return { sessions: s.data ?? [], projects: p.data ?? [], urgent: u.data ?? [], tasks: t.data ?? [] };
    },
  });

  const targets = parseTargets(settings?.category_targets ?? null);
  const categories = useMemo(() => {
    const set = new Set<string>(Object.keys(targets));
    for (const s of dataQ.data?.sessions ?? []) {
      const pr = s.projects as { bucket: string | null } | null;
      set.add(bucketLabel(settings, pr?.bucket ?? null));
    }
    return [...set];
  }, [dataQ.data, settings, targets]);
  const colorOf = (c: string) => COLORS[Math.max(0, categories.indexOf(c)) % COLORS.length];

  const byDay = useMemo(() => {
    const m: Record<string, Day> = {};
    const get = (k: string) => (m[k] ??= { sessions: [], deadlines: [], tasks: [] });
    const d = dataQ.data;
    if (!d) return m;
    for (const s of d.sessions) {
      if (!s.ended_at) continue;
      const start = s.work_started_at ?? s.created_at;
      const pr = s.projects as { name: string; bucket: string | null } | null;
      get(key(new Date(s.ended_at))).sessions.push({
        ...s,
        project_name: s.project_name ?? pr?.name ?? "Session",
        minutes: start ? Math.max(0, Math.round((new Date(s.ended_at).getTime() - new Date(start).getTime()) / 60000)) : 0,
        category: bucketLabel(settings, pr?.bucket ?? null),
      });
    }
    for (const p of d.projects) if (p.deadline && p.status !== "dropped") get(p.deadline).deadlines.push({ id: p.id, title: p.name, sub: "Project deadline" });
    for (const u of d.urgent)
      if (u.deadline && u.status !== "done")
        get(u.deadline).deadlines.push({ id: u.id, title: u.required_action || u.company || "Urgent item", sub: u.company ?? "Urgent item" });
    for (const t of d.tasks)
      if (t.due_date && t.status !== "dropped") {
        const pr = t.projects as { name: string } | null;
        get(t.due_date).tasks.push({ id: t.id, title: t.title, sub: `${pr?.name ?? ""}${t.status === "done" ? " · done" : ""}` });
      }
    return m;
  }, [dataQ.data, settings]);

  const todayKey = key(new Date());
  const move = (dir: number) =>
    setCursor((c) => (view === "week" ? addDays(c, 7 * dir) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));
  const title =
    view === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : `${from.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${addDays(to, -1).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  const sel = selected ? byDay[selected] : undefined;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => move(-1)} aria-label="Previous">‹</Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
          <Button size="sm" variant="outline" onClick={() => move(1)} aria-label="Next">›</Button>
          <div className="flex rounded-md border border-border">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-sm capitalize ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {categories.map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-sm ${colorOf(c)}`} />
            {c}
            {targets[c] != null && ` (${targets[c]}%)`}
          </span>
        ))}
      </div>

      {dataQ.error && <p className="mt-4 text-sm text-destructive">{(dataQ.error as Error).message}</p>}

      <div className="mt-4 grid grid-cols-7 gap-1 text-xs text-muted-foreground">
        {WEEKDAYS.map((w) => <div key={w} className="px-1">{w}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = key(d);
          const info = byDay[k];
          const out = view === "month" && d.getMonth() !== cursor.getMonth();
          const total = info?.sessions.reduce((a, s) => a + s.minutes, 0) ?? 0;
          const perCat: Record<string, number> = {};
          for (const s of info?.sessions ?? []) perCat[s.category] = (perCat[s.category] ?? 0) + s.minutes;
          return (
            <button
              key={k}
              onClick={() => setSelected(k)}
              className={`panel flex flex-col gap-1 overflow-hidden p-1.5 text-left transition-colors hover:border-primary ${view === "week" ? "min-h-64" : "min-h-24"} ${out ? "opacity-40" : ""} ${k === todayKey ? "border-primary" : ""}`}
            >
              <span className={`text-xs font-semibold ${k === todayKey ? "text-primary" : ""}`}>{d.getDate()}</span>
              {info?.deadlines.map((x) => (
                <span key={x.id} className="truncate rounded bg-destructive px-1 text-[10px] text-destructive-foreground">⚑ {x.title}</span>
              ))}
              {info?.sessions.map((s) => (
                <span key={s.id} className="flex items-center gap-1 truncate text-[10px]">
                  <span className={`h-2 w-2 shrink-0 rounded-sm ${colorOf(s.category)}`} />
                  <span className="truncate">{s.project_name} · {s.minutes}m</span>
                </span>
              ))}
              {info?.tasks.map((t) => (
                <span key={t.id} className="truncate text-[10px] text-muted-foreground">☐ {t.title}</span>
              ))}
              {view === "week" && (
                <div className="mt-auto space-y-1 pt-2">
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    {categories.map((c) =>
                      perCat[c] ? <div key={c} className={colorOf(c)} style={{ width: `${(perCat[c] / total) * 100}%` }} /> : null,
                    )}
                  </div>
                  <div className="flex h-1 overflow-hidden rounded-full bg-muted opacity-60">
                    {categories.map((c) =>
                      targets[c] ? <div key={c} className={colorOf(c)} style={{ width: `${targets[c]}%` }} /> : null,
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{total} min · target below</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selected && new Date(`${selected}T00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-6 px-4 text-sm">
            <section>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Deadlines</h3>
              {sel?.deadlines.length ? sel.deadlines.map((x) => (
                <p key={x.id} className="mb-1"><span className="rounded bg-destructive px-1.5 text-xs text-destructive-foreground">Due</span> {x.title} <span className="text-muted-foreground">· {x.sub}</span></p>
              )) : <p className="text-muted-foreground">None</p>}
            </section>
            <section>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Sessions</h3>
              {sel?.sessions.length ? sel.sessions.map((s) => (
                <div key={s.id} className="panel mb-2 space-y-1 p-3">
                  <p className="flex items-center gap-2 font-medium">
                    <span className={`h-2.5 w-2.5 rounded-sm ${colorOf(s.category)}`} />
                    {s.project_name} · {s.minutes} min
                  </p>
                  {s.recommended_action && <p><span className="text-muted-foreground">Action:</span> {s.recommended_action}</p>}
                  {s.outcome && <p><span className="text-muted-foreground">Outcome:</span> {s.outcome}</p>}
                  {s.where_stopped && <p><span className="text-muted-foreground">Stopped at:</span> {s.where_stopped}</p>}
                  <p className="text-xs text-muted-foreground">
                    Right task {s.right_task ?? "–"}/5 · Less stuck {s.less_stuck ?? "–"}/5 · Milestone moved {s.milestone_moved == null ? "–" : s.milestone_moved ? "yes" : "no"}
                  </p>
                </div>
              )) : <p className="text-muted-foreground">None</p>}
            </section>
            <section>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Tasks due</h3>
              {sel?.tasks.length ? sel.tasks.map((t) => (
                <p key={t.id} className="mb-1">☐ {t.title} <span className="text-muted-foreground">{t.sub && `· ${t.sub}`}</span></p>
              )) : <p className="text-muted-foreground">None</p>}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
