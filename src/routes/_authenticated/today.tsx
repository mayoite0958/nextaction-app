import { InfoTip } from "@/components/InfoTip";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CategoryBalance } from "@/components/CategoryBalance";
import { SessionPanel } from "@/components/SessionPanel";
import { fetchRecentSummary, parseTargets } from "@/lib/categories";
import { fetchWeekCounts, projectType } from "@/lib/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { bucketLabel, daysLeft, relativeTime } from "@/lib/nextaction";
import {
  draftRecommendation,
  loadRecommendContext,
  requestRecommendation,
  type Energy,
  type Recommendation,
  type RecommendContext,
} from "@/lib/n8n";

const LAST_KEY = "na_last_rec_inputs";
import type { Database } from "@/integrations/supabase/types";
import { ResurfaceCard } from "@/components/ResurfaceCard";
import { RestartCard } from "@/components/RestartCard";
import { daysSince } from "@/lib/categories";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Next Action" },
      {
        name: "description",
        content: "Your active projects, closest deadlines first, and your urgent/long-term balance.",
      },
      { property: "og:title", content: "Today — Next Action" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Your active projects, closest deadlines first, and your urgent/long-term balance.",
      },
    ],
  }),
  component: Today,
});

function Today() {
  const navigate = useNavigate();

  const settingsQuery = useQuery({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const settings = settingsQuery.data;
  const summaryQuery = useQuery({
    queryKey: ["recent_summary", settings?.bucket_urgent_label, settings?.bucket_longterm_label],
    enabled: !!settings,
    queryFn: () => fetchRecentSummary(settings),
  });
  const weekQuery = useQuery({ queryKey: ["week_counts"], queryFn: fetchWeekCounts });
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [timeMin, setTimeMin] = useState("30");
  const [energy, setEnergy] = useState<Energy>("Medium");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [resume, setResume] = useState<{ id: string; startedAt: string } | null>(null);
  const [resumeAction, setResumeAction] = useState<string | null>(null);
  const [autoStart, setAutoStart] = useState(false);

  // Start a session straight from a project card, without a recommendation.
  function startDirect(p: Pick<ProjectRow, "id" | "name" | "next_likely_action">, task?: { id: string; title: string } | null) {
    reqId.current++;
    setIsDraft(false);
    setRefining(false);
    setSlow(false);
    setAskError(null);
    setAutoStart(true);
    setResume(null);
    setRecommendation({
      project_id: p.id,
      project_name: p.name,
      next_action: task?.title || p.next_likely_action || `Work on ${p.name}`,
      done_looks_like: null,
      why: null,
      clarifying_question: null,
      task_id: task?.id ?? null,
      new_task_title: null,
      est_minutes: null,
      resource_id: null,
    } as Recommendation);
    setSessionNonce((n) => n + 1);
  }
  const [sessionNonce, setSessionNonce] = useState(0);
  const [openedResource, setOpenedResource] = useState<string | null>(null);

  // Bring back a session that was still running when the page reloaded.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.recommended_action || data.ended_at) return;
      // Only bring back sessions that could plausibly still be running.
      const started = new Date(data.work_started_at ?? data.created_at ?? 0).getTime();
      const limitMs = ((data.time_available_min ?? 30) + 120) * 60_000;
      if (!started || Date.now() - started > limitMs) return;
      setTimeMin(String(data.time_available_min ?? 30));
      if (data.energy) setEnergy(data.energy as Energy);
      setResumeAction(data.recommended_action);
      setResume({ id: data.id, startedAt: data.work_started_at ?? data.created_at ?? new Date().toISOString() });
      setRecommendation((r) => r ?? {
        project_id: data.project_id,
        project_name: data.project_name,
        next_action: data.recommended_action,
        done_looks_like: data.done_looks_like,
        why: data.reason,
        clarifying_question: null,
        task_id: data.task_id,
        new_task_title: null,
        est_minutes: null,
        resource_id: data.resource_id,
      } as Recommendation);
    })();
  }, []);

  const [isDraft, setIsDraft] = useState(false);
  const [refining, setRefining] = useState(false);
  const [slow, setSlow] = useState(false);
  const [inputsReady, setInputsReady] = useState(false);
  const ctxRef = useRef<Promise<RecommendContext> | null>(null);
  const ctxValue = useRef<RecommendContext | null>(null);
  const prefetch = useRef<{ key: string; promise: Promise<Recommendation>; value?: Recommendation } | null>(null);
  const reqId = useRef(0);

  const minutes = () => Math.max(1, Number.parseInt(timeMin, 10) || 30);

  function loadCtx(fresh = false) {
    if (!ctxRef.current || fresh) {
      const p = loadRecommendContext();
      ctxRef.current = p;
      p.then((c) => { if (ctxRef.current === p) ctxValue.current = c; }, () => { if (ctxRef.current === p) ctxRef.current = null; });
    }
    return ctxRef.current;
  }

  function startPrefetch(t: number, e: Energy) {
    const key = `${t}|${e}`;
    if (prefetch.current?.key === key) return prefetch.current;
    const entry: { key: string; promise: Promise<Recommendation>; value?: Recommendation } = {
      key,
      promise: loadCtx().then((c) => requestRecommendation({ time_min: t, energy: e, rejected_actions: [] }, c)),
    };
    entry.promise.then((v) => { entry.value = v; }, () => { if (prefetch.current === entry) prefetch.current = null; });
    prefetch.current = entry;
    return entry;
  }

  // Restore last-used time and energy, then load data for the instant draft.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
      if (saved?.timeMin) setTimeMin(String(saved.timeMin));
      if (["Low", "Medium", "High"].includes(saved?.energy)) setEnergy(saved.energy);
    } catch { /* ignore */ }
    setInputsReady(true);
    void loadCtx().catch(() => {});
  }, []);

  // Quietly prefetch an AI answer for the current time and energy.
  useEffect(() => {
    if (!inputsReady) return;
    const t = setTimeout(() => { startPrefetch(minutes(), energy); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsReady, timeMin, energy]);

  async function ask(rejectedActions: string[], opts: { fresh?: boolean } = {}) {
    const id = ++reqId.current;
    const t = minutes();
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ timeMin: t, energy })); } catch { /* ignore */ }
    setAskError(null);
    setAutoStart(false);
    setSlow(false);
    setResume(null);

    let aiPromise: Promise<Recommendation>;
    if (rejectedActions.length === 0 && !opts.fresh) {
      const entry = startPrefetch(t, energy);
      if (entry.value) {
        setIsDraft(false);
        setRefining(false);
        setRecommendation(entry.value);
        prefetch.current = null; // next tap asks again
        return;
      }
      aiPromise = entry.promise;
      prefetch.current = null;
    } else {
      aiPromise = loadCtx(true).then((c) => requestRecommendation({ time_min: t, energy, rejected_actions: rejectedActions }, c));
    }

    // Instant draft from the in-app ranking.
    const showDraft = (c: RecommendContext) => {
      if (id !== reqId.current) return;
      const d = draftRecommendation(c, t, energy);
      if (d && !rejectedActions.includes(d.next_action ?? "")) {
        setRecommendation(d);
        setIsDraft(true);
      }
    };
    if (ctxValue.current && rejectedActions.length === 0) showDraft(ctxValue.current);
    else if (rejectedActions.length === 0) void loadCtx().then(showDraft, () => {});
    setRefining(true);
    setAsking(true);

    const timer = setTimeout(() => {
      if (id !== reqId.current) return;
      setRefining(false);
      setAsking(false);
      setSlow(true);
      reqId.current++; // keep the draft; ignore a late answer
    }, 8000);

    try {
      const rec = await aiPromise;
      if (id !== reqId.current) return;
      setRecommendation((prev) => (prev && prev.project_id === rec.project_id ? { ...prev, ...rec } : rec));
      setIsDraft(false);
    } catch (e) {
      if (id !== reqId.current) return;
      if (ctxValue.current && draftRecommendation(ctxValue.current, t, energy)) setSlow(true);
      else setAskError(e instanceof Error ? e.message : "Could not reach n8n");
    } finally {
      clearTimeout(timer);
      if (id === reqId.current) {
        setRefining(false);
        setAsking(false);
      }
    }
  }

  function rejectCurrent() {
    if (!recommendation?.next_action) return;
    void supabase.from("sessions").insert({
      status: "rejected",
      project_id: recommendation.project_id,
      project_name: recommendation.project_name,
      recommended_action: recommendation.next_action,
      time_available_min: Math.max(1, Number.parseInt(timeMin, 10) || 30),
      energy,
    });
    const next = [...rejected, recommendation.next_action];
    setRejected(next);
    void ask(next);
  }

  useEffect(() => {
    if (settingsQuery.isSuccess && !settings) navigate({ to: "/onboarding", replace: true });
  }, [settingsQuery.isSuccess, settings, navigate]);

  if (settingsQuery.isLoading || !settings) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading your day…</p>
      </AppShell>
    );
  }

  const projects = projectsQuery.data ?? [];

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">
        {settings.display_name ? `Today, ${settings.display_name}` : "Today"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Optimising for {settings.value_label ?? "what matters to you"}.
      </p>

      <div className="mt-6">
        <CategoryBalance
          targets={parseTargets(settings.category_targets)}
          summary={summaryQuery.data ?? {}}
        />
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
          Your next action
        </h2>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center text-muted-foreground">Time available (min)<InfoTip k="timeAvailable" /></span>
            <Input
              type="number"
              min={5}
              step={5}
              value={timeMin}
              onChange={(e) => setTimeMin(e.target.value)}
              className="w-28"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center text-muted-foreground">Energy<InfoTip k="energy" /></span>
            <Select value={energy} onValueChange={(v) => setEnergy(v as Energy)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <Button size="sm" onClick={() => ask(rejected)} disabled={asking}>
            {asking ? "Thinking…" : recommendation ? "Ask again" : "Get my next action"}
          </Button>
          {recommendation?.next_action && (
            <Button size="sm" variant="outline" onClick={rejectCurrent} disabled={asking}>
              Not this one
            </Button>
          )}
        </div>

        {askError ? (
          <p className="mt-3 text-sm text-destructive">{askError}</p>
        ) : recommendation ? (
          <div
            key={recommendation.project_id ?? "none"}
            className="rec-in mt-4 space-y-3 text-sm transition-opacity duration-300"
          >
            {isDraft && (
              <Badge variant="outline" className="border-primary text-primary">Suggested</Badge>
            )}
            {recommendation.project_name && (
              <p>
                <span className="text-muted-foreground">Project: </span>
                <span className="font-semibold">{recommendation.project_name}</span>
              </p>
            )}
            {(() => {
              const rp = projects.find((p) => p.id === recommendation.project_id);
              const since = rp ? daysSince(rp.last_worked_at) : null;
              return rp && since != null && since >= 2 ? <RestartCard project={rp} /> : null;
            })()}
            <ResurfaceCard id={recommendation.resource_id} onOpen={() => setOpenedResource(recommendation.resource_id)} />
            {recommendation.next_action && (
              <p className="text-base font-medium">{recommendation.next_action}</p>
            )}
            <RecTask rec={recommendation} />
            {recommendation.done_looks_like && (
              <p>
                <span className="text-muted-foreground">Done looks like: </span>
                {recommendation.done_looks_like}
              </p>
            )}
            {recommendation.why && (
              <p>
                <span className="text-muted-foreground">Why this: </span>
                {recommendation.why}
              </p>
            )}
            {recommendation.clarifying_question && (
              <p className="text-muted-foreground italic">
                Question for you: {recommendation.clarifying_question}
              </p>
            )}
            {recommendation.next_action && (
              <SessionPanel
                key={`${recommendation.next_action}${resume ? resume.id : ""}${sessionNonce}`}
                resourceOpened={!!recommendation.resource_id && openedResource === recommendation.resource_id}
                onStart={() => { reqId.current++; setRefining(false); setAsking(false); setSlow(false); setIsDraft(false); }}
                onSwitch={({ project, task }) => startDirect(project, task)}
                recommendation={recommendation}
                timeMin={Math.max(1, Number.parseInt(timeMin, 10) || 30)}
                energy={energy}
                autoStart={autoStart}
                resume={resume && recommendation.next_action === resumeAction ? resume : undefined}
                currentProgress={
                  projects.find((p) => p.id === recommendation.project_id)?.progress_percent ?? null
                }
              />
            )}
            {refining && <p className="shimmer-text text-xs font-medium">AI is refining…</p>}
            {slow && isDraft && (
              <p className="text-xs text-muted-foreground">
                Using a quick suggestion ·{" "}
                <button type="button" className="text-primary underline" onClick={() => ask(rejected, { fresh: true })}>
                  Refresh
                </button>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {asking
              ? "Asking for a recommendation…"
              : "Set your time and energy, then ask for your next action."}
          </p>
        )}
      </section>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Active projects
        </h2>
        <Button size="sm" variant="outline" asChild>
          <Link to="/projects/$id" params={{ id: "new" }}>+ Add project</Link>
        </Button>
      </div>

      {projectsQuery.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No active projects yet. Add some and they'll show up here.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {projects.map((p: ProjectRow) => {
            const left = daysLeft(p.deadline);
            const bucket = p.bucket ?? "long_term";
            const badgeClass =
              bucket === "urgent"
                ? "bg-urgent text-urgent-foreground"
                : bucket === "long_term"
                  ? "bg-longterm text-longterm-foreground"
                  : "bg-muted text-foreground";
            return (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="panel flex flex-col gap-3 p-5 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold leading-tight">{p.name}</h3>
                  <Badge className={badgeClass}>{bucketLabel(settings, bucket)}</Badge>
                </div>

                {p.goal && <p className="text-sm text-muted-foreground">{p.goal}</p>}

                <p className="text-sm">
                  {left === null ? (
                    <span className="text-muted-foreground">No deadline</span>
                  ) : (
                    <span
                      className={
                        left <= 2 ? "font-semibold text-destructive" : "text-muted-foreground"
                      }
                    >
                      {left < 0
                        ? `${Math.abs(left)} days overdue`
                        : left === 0
                          ? "Due today"
                          : `${left} days left`}
                    </span>
                  )}
                </p>

                <div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>
                      {projectType(p.project_type) === "ongoing"
                        ? `${weekQuery.data?.[p.id] ?? 0}/${p.weekly_target ?? "?"} this week`
                        : `${p.progress_percent ?? 0}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${
                          projectType(p.project_type) === "ongoing"
                            ? p.weekly_target
                              ? Math.min(100, Math.round(((weekQuery.data?.[p.id] ?? 0) / p.weekly_target) * 100))
                              : 0
                            : (p.progress_percent ?? 0)
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <dl className="space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Importance</dt>
                    <dd>{p.value_score ?? 3}/5</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Blocker</dt>
                    <dd>{p.blocker || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Next action</dt>
                    <dd>{p.next_likely_action || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Last worked</dt>
                    <dd>{relativeTime(p.last_worked_at)}</dd>
                  </div>
                </dl>

                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-1 self-start"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startDirect(p);
                  }}
                >
                  ▶ Start session
                </Button>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function RecTask({ rec }: { rec: Recommendation }) {
  const q = useQuery({
    queryKey: ["task", rec.task_id],
    enabled: !!rec.task_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", rec.task_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const title = rec.task_id ? q.data?.title : rec.new_task_title;
  if (!title) return null;
  const est = rec.task_id ? q.data?.est_minutes : rec.est_minutes;
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {rec.task_id ? "Task" : "New task (added when you start)"}
      </p>
      <p className="mt-1 font-medium">
        {title}
        {est ? <span className="ml-2 text-sm text-muted-foreground">~{est} min</span> : null}
      </p>
    </div>
  );
}
