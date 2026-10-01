import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { reportSessionEnd, type Energy, type Recommendation } from "@/lib/n8n";

type Stage = "idle" | "working" | "ending" | "review";

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
  const [progress, setProgress] = useState(currentProgress ?? 0);
  const [suggested, setSuggested] = useState<number | null>(null);
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
    if (error) return toast.error(error.message);
    setSessionId(data.id);
    setStage("working");
  }

  async function end() {
    if (!sessionId) return;
    setBusy(true);
    const endedAt = new Date().toISOString();
    const { error } = await supabase
      .from("sessions")
      .update({
        status: "done",
        ended_at: endedAt,
        outcome: outcome.trim() || null,
        where_stopped: whereStopped.trim() || null,
      })
      .eq("id", sessionId);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    try {
      const pct = await reportSessionEnd({
        session_id: sessionId,
        project_id: recommendation.project_id,
        project_name: recommendation.project_name,
        action: recommendation.next_action,
        outcome: outcome.trim(),
        where_stopped: whereStopped.trim(),
        current_progress_percent: currentProgress,
      });
      setSuggested(pct);
      if (pct !== null) setProgress(pct);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach n8n");
    }
    setBusy(false);
    setStage("review");
    void qc.invalidateQueries({ queryKey: ["recent_summary"] });
  }

  async function saveProgress() {
    if (!recommendation.project_id) {
      setStage("idle");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("projects")
      .update({
        progress_percent: progress,
        last_worked_at: new Date().toISOString(),
        ...(outcome.trim() ? { last_meaningful_action: outcome.trim() } : {}),
      })
      .eq("id", recommendation.project_id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Progress saved.");
    await qc.invalidateQueries({ queryKey: ["projects"] });
    setStage("idle");
    setOutcome("");
    setWhereStopped("");
  }

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
      <div className="space-y-2">
        <Input placeholder="What did you get done?" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        <Input placeholder="Where did you stop?" value={whereStopped} onChange={(e) => setWhereStopped(e.target.value)} />
        <Button size="sm" onClick={end} disabled={busy}>
          {busy ? "Finishing…" : "Finish session"}
        </Button>
      </div>
    );

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <p className="text-sm">
        {suggested !== null
          ? `n8n estimates this project is now ${suggested}% done. Adjust if needed:`
          : "How far along is this project now?"}
      </p>
      <p className="font-display text-2xl font-semibold">{progress}%</p>
      <Slider min={0} max={100} step={1} value={[progress]} onValueChange={(v) => setProgress(v[0] ?? 0)} />
      <Button size="sm" onClick={saveProgress} disabled={busy}>
        {recommendation.project_id ? "Save progress" : "Done"}
      </Button>
    </div>
  );
}
