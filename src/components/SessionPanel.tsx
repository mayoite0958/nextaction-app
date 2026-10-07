import { useEffect, useRef, useState } from "react";
import { MicButton } from "@/components/MicButton";
import { ActiveSession, type SwitchTarget } from "@/components/ActiveSession";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  reportSessionEnd,
  type Energy,
  type Recommendation,
  type SessionEndOutput,
} from "@/lib/n8n";
import {
  computeProgress,
  recalcProjectProgress,
  parseMilestones,
  projectType,
  weekStart,
  type Milestone,
} from "@/lib/progress";
import { focusFromEvents, type Focus } from "@/lib/guard";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type Stage = "idle" | "working" | "ending" | "review" | "complete?" | "celebrate" | "done";

const OUTCOMES = [
  { label: "✅ Done", value: "Completed" },
  { label: "👍 Made progress", value: "Materially advanced" },
  { label: "😕 Not really", value: "Not really" },
];

export function SessionPanel({
  recommendation,
  timeMin,
  energy,
  resume,
  autoStart,
  onSwitch,
}: {
  onSwitch?: ((t: SwitchTarget) => void) | undefined;
  resume?: { id: string; startedAt: string } | undefined;
  recommendation: Recommendation;
  timeMin: number;
  energy: Energy;
  currentProgress?: number | null;
  autoStart?: boolean;
}) {
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>(resume ? "working" : "idle");
  const [sessionId, setSessionId] = useState<string | null>(resume?.id ?? null);
  const [whereStopped, setWhereStopped] = useState("");
  const [rightTask, setRightTask] = useState<number | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const endingRef = useRef(false);
  const [lessStuck, setLessStuck] = useState<number | null>(null);
  const [milestone, setMilestone] = useState<boolean | null>(null);
  const [resourceUsed, setResourceUsed] = useState<boolean | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [plusCount, setPlusCount] = useState(0);
  const [result, setResult] = useState<SessionEndOutput | null>(null);
  const [notesKept, setNotesKept] = useState<boolean[]>([]);
  const [tasksKept, setTasksKept] = useState<boolean[]>([]);
  const [markTaskDone, setMarkTaskDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(resume?.startedAt ?? null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [taskId, setTaskId] = useState<string | null>(recommendation.task_id);

  async function start() {
    setBusy(true);
    const now = new Date().toISOString();
    let tid = recommendation.task_id;
    if (!tid && recommendation.new_task_title && recommendation.project_id) {
      const t = await supabase
        .from("tasks")
        .insert({
          project_id: recommendation.project_id,
          title: recommendation.new_task_title,
          est_minutes: recommendation.est_minutes,
          energy,
          status: "doing",
          source: "ai",
        })
        .select("id")
        .single();
      if (t.error) { setBusy(false); toast.error(t.error.message); return; }
      tid = t.data.id;
    } else if (tid) {
      await supabase.from("tasks").update({ status: "doing" }).eq("id", tid);
    }
    setTaskId(tid);
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        status: "active",
        project_id: recommendation.project_id,
        project_name: recommendation.project_name,
        recommended_action: recommendation.next_action,
        done_looks_like: recommendation.done_looks_like,
        reason: recommendation.why,
        time_available_min: timeMin,
        energy,
        decision_started_at: now,
        work_started_at: now,
        task_id: tid,
        resource_id: recommendation.resource_id,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSessionId(data.id);
    setStartedAt(now);
    setStage("working");
  }

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && stage === "idle" && !autoStarted.current) {
      autoStarted.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, stage]);

  useEffect(() => {
    if (!ratingOpen) return;
    const timer = setTimeout(() => setRatingOpen(false), 10000);
    return () => clearTimeout(timer);
  }, [ratingOpen]);

  async function rateSuggestion(value: number) {
    if (!sessionId || ratingBusy) return;
    setRatingBusy(true);
    const { data, error } = await supabase.from("sessions").update({ right_task: value }).eq("id", sessionId).select("id");
    setRatingBusy(false);
    if (error || !data?.length) { toast.error(error?.message ?? "Could not save your feedback. Try again."); return; }
    setRightTask(value);
    setRatingOpen(false);
    void qc.invalidateQueries({ queryKey: ["calendar"] });
  }

  async function end(selectedOutcome: string) {
    if (!sessionId || endingRef.current) return;
    endingRef.current = true;
    setBusy(true);
    const action = recommendation.next_action ?? "";
    const stopped = whereStopped.trim();
    const { data: updated, error } = await supabase
      .from("sessions")
      .update({
        status: "done",
        ended_at: new Date().toISOString(),
        outcome: selectedOutcome,
        where_stopped: stopped || null,
        right_task: null,
        less_stuck: lessStuck,
        milestone_moved: milestone,
        ...(recommendation.resource_id ? { resource_used: resourceUsed } : {}),
      })
      .eq("id", sessionId)
      .select("id");
    if (error || !updated?.length) {
      endingRef.current = false;
      setBusy(false);
      toast.error(error?.message ?? "Couldn't save the end of this session. Please try again.");
      return;
    }
    setBusy(false);
    setStage("review");
    setRatingOpen(true);
    setSummarizing(true);
    void qc.invalidateQueries({ queryKey: ["calendar"] });
    if (taskId && selectedOutcome === "Completed") {
      await supabase.from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", taskId);
      if (recommendation.project_id) await recalcProjectProgress(recommendation.project_id);
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    }
    void qc.invalidateQueries({ queryKey: ["recent_summary"] });
    void qc.invalidateQueries({ queryKey: ["week_counts"] });
    let proj: ProjectRow | null = null;
    if (recommendation.project_id) {
      const res = await supabase.from("projects").select("*").eq("id", recommendation.project_id).maybeSingle();
      proj = res.data;
    }
    setProject(proj);
    const { data: eventRows } = await supabase
      .from("session_events")
      .select("type,text,ts")
      .eq("session_id", sessionId)
      .order("ts", { ascending: true });
    const events = (eventRows ?? []).map((e) => ({ type: e.type, text: e.text, time: e.ts }));
    let out: SessionEndOutput | null = null;
    try {
      out = await reportSessionEnd({ project: proj, action, outcome: selectedOutcome, where_stopped: stopped, events, ...(focus ? { focus } : {}) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach n8n");
    }
    setResult(out);
    setNotesKept((out?.notes ?? []).map(() => true));
    setTasksKept((out?.new_tasks ?? []).map(() => true));
    setMarkTaskDone(out?.task_done === true);
    const suggested = new Set((out?.milestone_suggestions ?? []).map((t) => t.trim().toLowerCase()));
    setMilestones(
      parseMilestones(proj?.milestones).map((m) => ({
        ...m,
        done: m.done || suggested.has(m.title.trim().toLowerCase()),
      })),
    );
    setPlusCount(0);
    setSummarizing(false);
  }

  const type = projectType(project?.project_type);

  async function saveProgress() {
    if (!project) { setStage("done"); return; }
    setBusy(true);
    if (sessionId) {
      const { data, error } = await supabase.from("sessions").update({
        where_stopped: whereStopped.trim() || null,
        less_stuck: lessStuck,
        milestone_moved: milestone,
        ...(recommendation.resource_id ? { resource_used: resourceUsed } : {}),
      }).eq("id", sessionId).select("id");
      if (error || !data?.length) { setBusy(false); toast.error(error?.message ?? "Could not save the details. Try again."); return; }
      void qc.invalidateQueries({ queryKey: ["calendar"] });
    }
    let doneThisWeek = 0;
    if (type === "ongoing") {
      const { count } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("status", "done")
        .gte("ended_at", weekStart().toISOString());
      doneThisWeek = count ?? 0;
    }
    const next = {
      ...project,
      milestones: (type === "finish_line" ? milestones : project.milestones) as Json,
      count_done: type === "countable" ? (project.count_done ?? 0) + plusCount : project.count_done,
    };
    const pct = computeProgress(next, doneThisWeek);
    const update: Database["public"]["Tables"]["projects"]["Update"] = {
      progress_percent: pct,
      last_worked_at: new Date().toISOString(),
      milestones: next.milestones,
      count_done: next.count_done,
    };
    if (result?.progress_summary) update.progress_summary = result.progress_summary;
    if (result?.last_meaningful_action) update.last_meaningful_action = result.last_meaningful_action;
    if (result?.next_likely_action) update.next_likely_action = result.next_likely_action;
    if (result?.blocker) update.blocker = result.blocker;
    const { error } = await supabase.from("projects").update(update).eq("id", project.id);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const keptNotes = (result?.notes ?? []).filter((_, i) => notesKept[i]);
    if (keptNotes.length) {
      await supabase.from("project_notes").insert(
        keptNotes.map((text) => ({ project_id: project.id, type: "note", text, source: "session" })),
      );
    }
    const keptTasks = (result?.new_tasks ?? []).filter((_, i) => tasksKept[i]);
    if (keptTasks.length) {
      await supabase.from("tasks").insert(
        keptTasks.map((t) => ({ project_id: project.id, title: t.title, est_minutes: t.est_minutes, source: "ai" })),
      );
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    }
    if (markTaskDone && taskId) {
      await supabase.from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", taskId);
      if (recommendation.project_id) await recalcProjectProgress(recommendation.project_id);
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    }
    setBusy(false);
    toast.success("Project updated.");
    await qc.invalidateQueries({ queryKey: ["projects"] });
    await qc.invalidateQueries({ queryKey: ["project", project.id] });
    setStage(pct >= 100 && type !== "ongoing" ? "complete?" : "done");
  }

  async function markComplete() {
    if (!project) return;
    setBusy(true);
    const { error } = await supabase.from("projects").update({ status: "completed" }).eq("id", project.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["projects"] });
    setStage("celebrate");
  }

  const nextMove = result?.next_move ? (
    <div className="rounded-md bg-muted p-3 text-sm">
      <p className="text-muted-foreground">Your next move when you come back</p>
      <p className="mt-1 font-medium">{result.next_move}</p>
    </div>
  ) : null;

  if (stage === "idle")
    return (
      <Button size="sm" variant="secondary" onClick={start} disabled={busy}>
        Start this session
      </Button>
    );

  if (stage === "working" && sessionId && startedAt)
    return (
      <ActiveSession
        sessionId={sessionId}
        startedAt={startedAt}
        projectId={recommendation.project_id}
        timeMin={timeMin}
        action={recommendation.next_action ?? "this task"}
        onSwitch={onSwitch}
        onEnd={async (workedSec) => {
          setStage("ending");
          const { data } = await supabase.from("session_events").select("type,text").eq("session_id", sessionId);
          setFocus(focusFromEvents(data ?? [], workedSec / 60));
        }}
      />
    );

  if (stage === "ending")
    return (
      <div className="space-y-3 rounded-md border border-border p-4">
        <p className="font-display text-lg font-semibold">How did it go?</p>
        <div className="grid gap-2">
          {OUTCOMES.map((option) => (
            <Button key={option.value} variant="outline" className="h-14 w-full text-base" onClick={() => end(option.value)} disabled={busy}>
              {option.label}
            </Button>
          ))}
        </div>
        {busy && <p role="status" className="text-sm text-muted-foreground">Saving…</p>}
      </div>
    );

  if (stage === "complete?")
    return (
      <div className="space-y-3 rounded-md border border-primary p-4">
        <p className="font-medium">You hit 100%. Mark this project complete?</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={markComplete} disabled={busy}>Yes, complete it</Button>
          <Button size="sm" variant="outline" onClick={() => setStage("done")}>Not yet</Button>
        </div>
        {nextMove}
      </div>
    );

  if (stage === "celebrate")
    return (
      <div className="rounded-md border border-primary p-5 text-center">
        <p className="animate-bounce text-4xl" aria-hidden>🎉</p>
        <p className="mt-2 font-display text-lg font-semibold text-primary">
          {project?.name ?? "Project"} is complete!
        </p>
        <p className="text-sm text-muted-foreground">Nice work — that one's off your plate.</p>
      </div>
    );

  if (stage === "done")
    return (
      <div className="space-y-3">
        <p className="text-sm text-primary">Session saved.</p>
        {nextMove}
      </div>
    );

  // review
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm text-primary">Session saved.</p>
      {ratingOpen && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Was this a good suggestion?</p>
          <div className="grid grid-cols-3 gap-2">
            {[{ icon: "👎", value: 1, label: "Poor suggestion" }, { icon: "😐", value: 3, label: "Okay suggestion" }, { icon: "👍", value: 5, label: "Good suggestion" }].map((rating) => (
              <Button key={rating.value} variant="outline" aria-label={rating.label} title={rating.label} className="h-11 text-xl" disabled={ratingBusy} onClick={() => rateSuggestion(rating.value)}>{rating.icon}</Button>
            ))}
          </div>
        </div>
      )}
      {rightTask != null && <p className="text-xs text-muted-foreground">Feedback saved.</p>}
      {focus && <p className="text-sm text-muted-foreground">Focus {focus.minutes_on_task} min · {focus.detours} detours ({focus.away_minutes} min away) · {focus.checkins} check-ins</p>}
      {summarizing && <p role="status" className="text-sm text-muted-foreground">Writing your summary…</p>}
      {nextMove}
      <details className="group">
        <summary className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4">Add details (optional)</summary>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5 text-sm">
            <label htmlFor={`stopped-${sessionId}`} className="text-muted-foreground">Where did you stop?</label>
            <div className="flex gap-2">
              <Input id={`stopped-${sessionId}`} className="min-w-0" value={whereStopped} onChange={(e) => setWhereStopped(e.target.value)} />
              <MicButton onText={(t) => setWhereStopped((w) => (w ? `${w} ${t}` : t))} />
            </div>
          </div>
          <Chips label="Less stuck?" options={["1", "2", "3", "4", "5"]} value={lessStuck == null ? "" : String(lessStuck)} onChange={(v) => setLessStuck(Number(v))} />
          <Chips label="Milestone moved?" options={["Yes", "No"]} value={milestone == null ? "" : milestone ? "Yes" : "No"} onChange={(v) => setMilestone(v === "Yes")} />
          {recommendation.resource_id && <Chips label="Did you use the resource?" options={["Yes", "No"]} value={resourceUsed == null ? "" : resourceUsed ? "Yes" : "No"} onChange={(v) => setResourceUsed(v === "Yes")} />}
      {project && type === "finish_line" && milestones.length > 0 && (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Tick the milestones you finished</p>
          {milestones.map((m, i) => (
            <Button
              key={i}
              variant="outline"
              type="button"
              onClick={() => setMilestones((ms) => ms.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              className={`h-auto flex w-full items-center gap-3 whitespace-normal rounded-md border p-3 text-left ${m.done ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <span className="text-lg">{m.done ? "☑" : "☐"}</span>
              <span className="flex-1">{m.title}</span>
              <span className="text-muted-foreground">{m.weight}%</span>
            </Button>
          ))}
        </div>
      )}
      {project && type === "countable" && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Done this session</span>
          <Button size="sm" variant="outline" onClick={() => setPlusCount((c) => Math.max(0, c - 1))}>−</Button>
          <span className="w-8 text-center font-display text-xl font-semibold">{plusCount}</span>
          <Button size="sm" onClick={() => setPlusCount((c) => c + 1)}>+1</Button>
          <span className="text-muted-foreground">
            {(project.count_done ?? 0) + plusCount}/{project.count_total ?? "?"}
          </span>
        </div>
      )}
      {project && (result?.notes.length || result?.new_tasks.length || (taskId && result?.task_done)) ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Suggested by your coach — untick anything you don't want</p>
          {(result?.notes ?? []).map((n, i) => (
            <CheckRow key={`n${i}`} checked={notesKept[i] ?? true} onToggle={() => setNotesKept((k) => k.map((v, j) => (j === i ? !v : v)))} label={`📝 ${n}`} />
          ))}
          {(result?.new_tasks ?? []).map((t, i) => (
            <CheckRow key={`t${i}`} checked={tasksKept[i] ?? true} onToggle={() => setTasksKept((k) => k.map((v, j) => (j === i ? !v : v)))} label={`✅ New task: ${t.title}${t.est_minutes ? ` (~${t.est_minutes} min)` : ""}`} />
          ))}
          {taskId && result?.task_done && (
            <CheckRow checked={markTaskDone} onToggle={() => setMarkTaskDone((v) => !v)} label="✔ Mark task done" />
          )}
        </div>
      ) : null}
      <Button size="sm" onClick={saveProgress} disabled={busy || summarizing}>
        {busy ? "Saving…" : "Save details"}
      </Button>
        </div>
      </details>
    </div>
  );
}

function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Button
      variant="outline"
      type="button"
      onClick={onToggle}
      className={`h-auto flex w-full items-center gap-3 whitespace-normal rounded-md border p-2.5 text-left ${checked ? "border-primary bg-primary/10" : "border-border"}`}
    >
      <span>{checked ? "☑" : "☐"}</span>
      <span className="flex-1">{label}</span>
    </Button>
  );
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <p className="text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o}
            type="button"
            variant={value === o ? "default" : "outline"}
            className="min-w-11 rounded-full"
            onClick={() => onChange(o)}
          >
            {o}
          </Button>
        ))}
      </div>
    </div>
  );
}

