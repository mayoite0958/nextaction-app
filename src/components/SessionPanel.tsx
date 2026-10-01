import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  reportSessionEnd,
  type Energy,
  type Recommendation,
  type SessionEndOutput,
} from "@/lib/n8n";

type Stage = "idle" | "working" | "ending" | "review" | "done";

export function SessionPanel({
  recommendation,
  timeMin,
  energy,
  currentProgress,
}: {
  recommendation: Recommendation;
  timeMin: number;
  energy: Energy;
  currentProgress: number | null;
}) {
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [whereStopped, setWhereStopped] = useState("");
  const [rightTask, setRightTask] = useState(3);
  const [lessStuck, setLessStuck] = useState(3);
  const [milestone, setMilestone] = useState(false);
  const [progress, setProgress] = useState(currentProgress ?? 0);
  const [result, setResult] = useState<SessionEndOutput | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const now = new Date().toISOString();
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
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSessionId(data.id);
    setStage("working");
  }

  async function end() {
    if (!sessionId) return;
    if (!outcome) { toast.error("Pick an outcome."); return; }
    setBusy(true);
    const { error } = await supabase
      .from("sessions")
      .update({
        status: "done",
        ended_at: new Date().toISOString(),
        outcome,
        where_stopped: whereStopped.trim() || null,
        right_task: rightTask,
        less_stuck: lessStuck,
        milestone_moved: milestone,
      })
      .eq("id", sessionId);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["recent_summary"] });
    try {
      let project = null;
      if (recommendation.project_id) {
        const res = await supabase.from("projects").select("*").eq("id", recommendation.project_id).maybeSingle();
        project = res.data;
      }
      const out = await reportSessionEnd({
        project,
        action: recommendation.next_action,
        outcome,
        where_stopped: whereStopped.trim(),
      });
      setResult(out);
      setProgress(out.progress_percent ?? project?.progress_percent ?? currentProgress ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach n8n");
      setResult(null);
    }
    setBusy(false);
    setStage("review");
  }

  async function saveProgress() {
    if (!recommendation.project_id) {
      setStage("done");
      return;
    }
    setBusy(true);
    const update: Database["public"]["Tables"]["projects"]["Update"] = {
      progress_percent: progress,
      last_worked_at: new Date().toISOString(),
    };
    if (result?.progress_summary) update.progress_summary = result.progress_summary;
    if (result?.last_meaningful_action) update.last_meaningful_action = result.last_meaningful_action;
    if (result?.next_likely_action) update.next_likely_action = result.next_likely_action;
    if (result?.blocker) update.blocker = result.blocker;
    const { error } = await supabase.from("projects").update(update).eq("id", recommendation.project_id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project updated.");
    await qc.invalidateQueries({ queryKey: ["projects"] });
    setStage("done");
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

  if (stage === "working")
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-primary">Session in progress…</span>
        <Button size="sm" onClick={() => setStage("ending")}>End session</Button>
      </div>
    );

  if (stage === "ending")
    return (
      <div className="space-y-4 rounded-md border border-border p-4">
        <Choice
          label="Outcome"
          options={["Completed", "Materially advanced", "Not really"]}
          value={outcome}
          onChange={setOutcome}
        />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Where did you stop?</span>
          <Input value={whereStopped} onChange={(e) => setWhereStopped(e.target.value)} />
        </label>
        <Choice label="Right task? (1–5)" options={["1", "2", "3", "4", "5"]} value={String(rightTask)} onChange={(v) => setRightTask(Number(v))} />
        <Choice label="Less stuck? (1–5)" options={["1", "2", "3", "4", "5"]} value={String(lessStuck)} onChange={(v) => setLessStuck(Number(v))} />
        <Choice label="Milestone moved?" options={["Yes", "No"]} value={milestone ? "Yes" : "No"} onChange={(v) => setMilestone(v === "Yes")} />
        <Button size="sm" onClick={end} disabled={busy}>
          {busy ? "Finishing…" : "Submit"}
        </Button>
      </div>
    );

  if (stage === "done")
    return (
      <div className="space-y-3">
        <p className="text-sm text-primary">Session saved.</p>
        {nextMove}
      </div>
    );

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <p className="text-sm">
        {result?.progress_percent != null
          ? `n8n estimates this project is now ${result.progress_percent}% done. Adjust if needed:`
          : "How far along is this project now?"}
      </p>
      <p className="font-display text-2xl font-semibold">{progress}%</p>
      <Slider min={0} max={100} step={1} value={[progress]} onValueChange={(v) => setProgress(v[0] ?? 0)} />
      {nextMove}
      <Button size="sm" onClick={saveProgress} disabled={busy}>
        {recommendation.project_id ? "Save to project" : "Done"}
      </Button>
    </div>
  );
}

function Choice({
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
          <Button key={o} type="button" size="sm" variant={value === o ? "default" : "outline"} onClick={() => onChange(o)}>
            {o}
          </Button>
        ))}
      </div>
    </div>
  );
}
