import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MicButton } from "@/components/MicButton";
import { parseGuard } from "@/lib/guard";
import { HandyPanel } from "@/components/HandyPanel";

type Ev = { id: string; ts: string | null; type: string | null; text: string | null; session_id: string | null };

const LABELS: Record<string, string> = {
  step_done: "✓ Step done",
  stuck: "😣 Stuck",
  note: "🎤 Note",
  pause: "⏸ Paused",
  resume: "▶ Resumed",
  switch: "↪ Switched",
  checkin: "✓ Still on it",
  no_response: "· No reply to check-in",
  away_ok: "↩ Away, part of the task",
  extend: "+15 min",
  back_on_track: "▶ Back on track",
};
type Proj = { id: string; name: string; next_likely_action: string | null };
type Task = { id: string; title: string; project_id: string | null };
export type SwitchTarget = { project: Proj; task: Task | null };

function notify(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      new Notification(title, { body, icon: "/icon-192.png", tag: "next-action-guard" });
    }
  } catch { /* in-app banner is enough */ }
}

/** Active-session milliseconds, excluding time between pause and resume. */
function workedMs(startedAt: string, events: Ev[], now: number) {
  let total = 0;
  let from: number | null = new Date(startedAt).getTime();
  for (const e of [...events].sort((a, b) => (a.ts ?? "").localeCompare(b.ts ?? ""))) {
    const t = new Date(e.ts ?? 0).getTime();
    if (e.type === "pause" && from != null) { total += t - from; from = null; }
    else if (e.type === "resume" && from == null) from = t;
  }
  if (from != null) total += now - from;
  return Math.max(0, total);
}

export function ActiveSession({
  sessionId,
  startedAt,
  projectId,
  timeMin,
  action,
  onEnd,
  onSwitch,
}: {
  onSwitch?: ((t: SwitchTarget) => void) | undefined;
  sessionId: string;
  startedAt: string;
  projectId: string | null;
  timeMin: number;
  action: string;
  onEnd: (workedSec: number) => void;
}) {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const evQuery = useQuery({
    queryKey: ["session_events_today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_events")
        .select("id, ts, type, text, session_id")
        .gte("ts", dayStart.toISOString())
        .order("ts", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Ev[];
    },
  });
  const guardQuery = useQuery({
    queryKey: ["guard_mode"],
    queryFn: async () => {
      const { data } = await supabase.from("user_settings").select("guard_mode").maybeSingle();
      return parseGuard(data?.guard_mode);
    },
  });
  const guard = guardQuery.data ?? { on: true, interval: 15 };
  const [checkin, setCheckin] = useState<{ at: number } | null>(null);
  const [switchReason, setSwitchReason] = useState<string | null>(null);
  const [away, setAway] = useState<number | null>(null);
  const [overtimeSeen, setOvertimeSeen] = useState(0);
  const [sheet, setSheet] = useState<null | "ask" | "pick">(null);
  const [reason, setReason] = useState("");
  const [pickOutcome, setPickOutcome] = useState("");
  const [pickId, setPickId] = useState("");
  const [busy, setBusy] = useState(false);
  const [handy, setHandy] = useState<{ kind: "session_start" | "step_done" | "stuck"; n: number }>({ kind: "session_start", n: 0 });
  const targets = useQuery({
    queryKey: ["switch_targets"],
    enabled: sheet === "pick",
    queryFn: async () => {
      const [p, t] = await Promise.all([
        supabase.from("projects").select("id,name,next_likely_action").eq("status", "active").order("name"),
        supabase.from("tasks").select("id,title,project_id").in("status", ["todo", "doing"]),
      ]);
      return { projects: (p.data ?? []) as Proj[], tasks: (t.data ?? []) as Task[] };
    },
  });
  const nextCheck = useRef<number | null>(null);
  const hiddenAt = useRef<number | null>(null);

  // Ask for notification permission once per session start.
  useEffect(() => {
    if (!guard.on || typeof Notification === "undefined") return;
    if (Notification.permission === "default") void Notification.requestPermission().catch(() => {});
  }, [guard.on]);

  // Away detection.
  useEffect(() => {
    if (!guard.on) return;
    const onVis = () => {
      if (document.hidden) { hiddenAt.current = Date.now(); return; }
      if (hiddenAt.current == null) return;
      const mins = Math.round((Date.now() - hiddenAt.current) / 60000);
      hiddenAt.current = null;
      if (Date.now() - (hiddenAt.current ?? 0) > 0 && mins >= 5) setAway(mins);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [guard.on]);

  const all = evQuery.data ?? [];
  const mine = all.filter((e) => e.session_id === sessionId);
  const lastToggle = [...mine].reverse().find((e) => e.type === "pause" || e.type === "resume");
  const paused = lastToggle?.type === "pause";
  const lastDetour = [...mine].reverse().find((e) => e.type === "switch" || e.type === "back_on_track" || e.type === "resume");
  const detourAt = paused && lastDetour?.type === "switch" && !/^\d+ min away$/.test(lastDetour.text ?? "") ? lastDetour.ts : null;

  useEffect(() => {
    if (paused && !detourAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused, detourAt]);

  async function tap(type: string, text: string | null = null) {
    const { error } = await supabase.from("session_events").insert({ session_id: sessionId, type, text });
    if (error) { toast.error(error.message); return; }
    if (type === "note" && text && projectId) {
      await supabase.from("project_notes").insert({ project_id: projectId, type: "note", text, source: "session" });
    }
    setNow(Date.now());
    if (type === "step_done" || type === "stuck") setHandy((h) => ({ kind: type, n: h.n + 1 }));
    await qc.invalidateQueries({ queryKey: ["session_events_today"] });
  }

  async function openDetour() {
    setCheckin(null);
    setReason("");
    setSheet("ask");
    if (!paused) await tap("pause");
  }
  async function quickDetour() {
    setSheet(null);
    await tap("switch", reason.trim() || "Detour");
  }
  async function backOnTrack() {
    const mins = detourAt ? Math.max(0, Math.round((Date.now() - new Date(detourAt).getTime()) / 60000)) : 0;
    await tap("back_on_track", `${mins} min`);
    await tap("resume");
  }
  async function cancelDetour() {
    setSheet(null);
    await tap("resume");
  }
  async function confirmSwitch() {
    const list = targets.data;
    if (!list || !pickOutcome || !pickId) return;
    const [kind, id] = pickId.split(":");
    const task = kind === "t" ? list.tasks.find((t) => t.id === id) ?? null : null;
    const project = list.projects.find((p) => p.id === (task ? task.project_id : id));
    if (!project) return;
    setBusy(true);
    if (reason.trim()) await tap("switch", reason.trim());
    const { data: upd, error } = await supabase.from("sessions").update({
      status: "done",
      ended_at: new Date().toISOString(),
      outcome: pickOutcome,
      where_stopped: `Switched to ${task ? task.title : project.name}`,
    }).eq("id", sessionId).select("id,task_id");
    if (error || !upd?.length) { setBusy(false); toast.error(error?.message ?? "Couldn't end this session. Try again."); return; }
    const doneTask = upd[0]?.task_id;
    if (pickOutcome === "Completed" && doneTask) {
      await supabase.from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", doneTask);
    }
    void qc.invalidateQueries({ queryKey: ["week_counts"] });
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    setBusy(false);
    setSheet(null);
    onSwitch?.({ project, task });
  }

  async function saveNote() {
    if (!note.trim()) return;
    await tap("note", note.trim());
    setNote("");
    setNoteOpen(false);
  }

  const secs = Math.floor(workedMs(startedAt, mine, paused ? new Date(lastToggle?.ts ?? Date.now()).getTime() : now) / 1000);
  const extends_ = mine.filter((e) => e.type === "extend").length;
  const plannedSec = (timeMin + extends_ * 15) * 60;
  const overtime = secs >= plannedSec && overtimeSeen < plannedSec;

  // Check-ins: halfway, then every interval.
  useEffect(() => {
    if (!guard.on || paused) return;
    if (nextCheck.current == null) nextCheck.current = Math.round((timeMin * 60) / 2);
    if (secs >= nextCheck.current && !checkin && switchReason == null && sheet == null) {
      nextCheck.current = secs + guard.interval * 60;
      setCheckin({ at: Date.now() });
      notify(`Still on ${action}?`, "Tap to answer in Next Action.");
    }
  }, [secs, guard.on, guard.interval, paused, checkin, switchReason, sheet, timeMin, action]);

  // No reply within 2 minutes.
  useEffect(() => {
    if (!checkin) return;
    const t = setTimeout(() => { setCheckin(null); void tap("no_response"); }, 2 * 60 * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkin]);

  useEffect(() => {
    if (overtime) notify("Time's up", "Wrap up, or add 15 minutes?");
  }, [overtime]);

  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
        <span className={`text-sm ${paused ? "text-muted-foreground" : "text-primary"}`}>
          {detourAt ? `On a detour · ${Math.max(0, Math.floor((now - new Date(detourAt).getTime()) / 60000))} min` : paused ? "Paused" : "Session in progress"}
        </span>
        <span className="font-display text-3xl font-semibold tabular-nums">{clock}</span>
      </div>
      {detourAt ? (
        <Button size="lg" className="h-16 w-full text-lg" onClick={backOnTrack}>▶ Back on track</Button>
      ) : sheet == null && (
       <div className="space-y-3">
         <div className="grid grid-cols-[repeat(auto-fit,minmax(48px,1fr))] gap-1.5">
           {[
             { icon: "✓", label: "Done step", run: () => tap("step_done"), disabled: paused },
             { icon: "😣", label: "Stuck", run: () => tap("stuck"), disabled: paused },
             { icon: "🎤", label: "Note", run: () => setNoteOpen((o) => !o) },
             { icon: paused ? "▶" : "⏸", label: paused ? "Resume" : "Pause", run: () => tap(paused ? "resume" : "pause") },
             { icon: "↪", label: "Detour", run: openDetour },
           ].map((control) => (
             <Button key={control.label} title={control.label} aria-label={`${control.icon} ${control.label}`} variant={control.label === "Resume" ? "default" : "outline"} disabled={control.disabled} onClick={control.run} className="h-16 min-w-0 flex-col gap-1 whitespace-normal px-0.5 py-2">
               <span aria-hidden="true" className="text-xl leading-none">{control.icon}</span>
               <span className="w-full text-center text-[10px] leading-3">{control.label}</span>
             </Button>
           ))}
         </div>
         <Button className="h-11 w-full" onClick={() => onEnd(secs)}>End session</Button>
       </div>
      )}
      {sheet === "ask" && (
        <Banner text="What pulled you away? (optional)">
          <Input autoFocus placeholder="e.g. Urgent call from a recruiter" value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-0 flex-1" />
          <MicButton onText={(t) => setReason((r) => (r ? `${r} ${t}` : t))} />
          <div className="flex w-full flex-wrap gap-2">
            <Button size="sm" onClick={quickDetour}>Quick detour</Button>
            <Button size="sm" variant="outline" onClick={() => setSheet("pick")}>Switch to another project</Button>
            <Button size="sm" variant="ghost" onClick={cancelDetour}>Cancel</Button>
          </div>
        </Banner>
      )}
      {sheet === "pick" && (
        <Banner text="How did this session go?">
          <div className="flex w-full flex-wrap gap-2">
            {["Completed", "Materially advanced", "Not really"].map((o) => (
              <Button key={o} size="sm" variant={pickOutcome === o ? "default" : "outline"} onClick={() => setPickOutcome(o)}>{o === "Materially advanced" ? "Made progress" : o}</Button>
            ))}
          </div>
          <select value={pickId} onChange={(e) => setPickId(e.target.value)} className="w-full rounded-md border border-border bg-background p-2">
            <option value="">Switch to…</option>
            {(targets.data?.projects ?? []).map((p) => (
              <optgroup key={p.id} label={p.name}>
                <option value={`p:${p.id}`}>{p.name}</option>
                {(targets.data?.tasks ?? []).filter((t) => t.project_id === p.id).map((t) => (
                  <option key={t.id} value={`t:${t.id}`}>— {t.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="flex w-full gap-2">
            <Button size="sm" onClick={confirmSwitch} disabled={busy || !pickOutcome || !pickId}>Save and switch</Button>
            <Button size="sm" variant="ghost" onClick={cancelDetour}>Cancel</Button>
          </div>
        </Banner>
      )}
      {checkin && (
        <Banner text={`Still on ${action}?`}>
          <Button size="sm" onClick={() => { setCheckin(null); void tap("checkin"); }}>✓ Still on it</Button>
          <Button size="sm" variant="outline" onClick={() => { void openDetour(); }}>↪ I switched</Button>
        </Banner>
      )}
      {switchReason != null && (
        <Banner text="What pulled you away? (optional)">
          <Input autoFocus placeholder="e.g. Urgent call from a recruiter" value={switchReason} onChange={(e) => setSwitchReason(e.target.value)} className="min-w-0 flex-1" />
          <MicButton onText={(t) => setSwitchReason((r) => (r ? `${r} ${t}` : t))} />
          <Button size="sm" onClick={() => { const r = switchReason.trim(); setSwitchReason(null); void tap("switch", r || null); }}>Save</Button>
        </Banner>
      )}
      {away != null && (
        <Banner text={`You were away ${away} minutes. Was that part of the task?`}>
          <Button size="sm" onClick={() => { const m = away; setAway(null); void tap("away_ok", `${m} min away`); }}>Yes</Button>
          <Button size="sm" variant="outline" onClick={() => { const m = away; setAway(null); void tap("switch", `${m} min away`); }}>No</Button>
        </Banner>
      )}
      {overtime && (
        <Banner text="Time's up. Wrap up, or add 15 minutes?">
          <Button size="sm" onClick={() => onEnd(secs)}>End session</Button>
          <Button size="sm" variant="outline" onClick={() => { setOvertimeSeen(plannedSec); void tap("extend"); }}>+15 min</Button>
        </Banner>
      )}
      {noteOpen && (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="e.g. Need a better hero image"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveNote()}
          />
          <MicButton onText={(t) => setNote((n) => (n ? `${n} ${t}` : t))} />
          <Button onClick={saveNote} disabled={!note.trim()}>Save</Button>
        </div>
      )}
      <HandyPanel sessionId={sessionId} projectId={projectId} action={action} trigger={handy} events={mine} />
      {all.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Today's taps</p>
          <ol className="mt-2 space-y-1 border-l border-border pl-3 text-sm">
            {all.map((e) => (
              <li key={e.id} className={e.session_id === sessionId ? "" : "text-muted-foreground"}>
                <span className="mr-2 tabular-nums text-muted-foreground">
                  {e.ts ? new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
                {LABELS[e.type ?? ""] ?? e.type}
                {e.text && <span className="text-muted-foreground"> — {e.text}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Banner({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div role="status" className="space-y-2 rounded-md border border-primary/60 bg-primary/10 p-3 text-sm">
      <p className="font-medium">{text}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
