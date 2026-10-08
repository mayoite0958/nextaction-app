import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { recalcProjectProgress } from "@/lib/progress";

const OUTCOMES = [
  { v: "Completed", l: "✅ Done" },
  { v: "Materially advanced", l: "👍 Made progress" },
  { v: "Not really", l: "😕 Not really" },
];
const MINS = [15, 25, 45, 60, 90];

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LogPastWork({ projectId }: { projectId?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pid, setPid] = useState(projectId ?? "");
  const [date, setDate] = useState(localToday());
  const [mins, setMins] = useState("25");
  const [taskId, setTaskId] = useState("");
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("Materially advanced");
  const [note, setNote] = useState("");
  const [markDone, setMarkDone] = useState(true);
  const [saving, setSaving] = useState(false);

  const projects = useQuery({
    queryKey: ["log-past-projects"],
    enabled: open && !projectId,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name").eq("status", "active").order("name");
      return data ?? [];
    },
  });
  const tasks = useQuery({
    queryKey: ["log-past-tasks", pid],
    enabled: open && !!pid,
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id,title,status").eq("project_id", pid).neq("status", "dropped").order("created_at");
      return data ?? [];
    },
  });

  async function save() {
    const m = Number.parseInt(mins, 10);
    if (!pid) { toast.error("Pick a project."); return; }
    if (!Number.isFinite(m) || m <= 0) { toast.error("Enter minutes worked."); return; }
    if (date > localToday()) { toast.error("Pick today or an earlier day."); return; }
    const task = tasks.data?.find((t) => t.id === taskId);
    const what = action.trim() || task?.title || "";
    if (!what) { toast.error("Say what you worked on."); return; }
    setSaving(true);
    // End at 6pm local on that day (or now, if today), start = end - minutes.
    const end = new Date(`${date}T18:00:00`);
    const now = new Date();
    if (end > now) end.setTime(now.getTime());
    const start = new Date(end.getTime() - m * 60000);
    const projName = projects.data?.find((p) => p.id === pid)?.name;
    let pname = projName;
    if (!pname) {
      const { data } = await supabase.from("projects").select("name,last_worked_at").eq("id", pid).maybeSingle();
      pname = data?.name;
    }
    const { error } = await supabase.from("sessions").insert({
      project_id: pid,
      project_name: pname ?? null,
      task_id: task?.id ?? null,
      recommended_action: what,
      status: "done",
      source: "manual_log",
      outcome,
      where_stopped: note.trim() || null,
      time_available_min: m,
      decision_started_at: start.toISOString(),
      work_started_at: start.toISOString(),
      ended_at: end.toISOString(),
    });
    if (error) { setSaving(false); toast.error(error.message); return; }
    if (task && markDone && task.status !== "done") {
      await supabase.from("tasks").update({ status: "done", done_at: end.toISOString() }).eq("id", task.id);
    }
    const { data: pr } = await supabase.from("projects").select("last_worked_at").eq("id", pid).maybeSingle();
    if (!pr?.last_worked_at || new Date(pr.last_worked_at) < end) {
      await supabase.from("projects").update({ last_worked_at: end.toISOString() }).eq("id", pid);
    }
    await recalcProjectProgress(pid);
    setSaving(false);
    toast.success("Past work logged.");
    setOpen(false);
    setAction(""); setNote(""); setTaskId("");
    void qc.invalidateQueries();
  }

  if (!open) {
    return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>🗓 Log past work</Button>;
  }
  return (
    <div className="panel mt-3 w-full space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">Log past work</h3>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-muted-foreground">×</button>
      </div>
      {!projectId && (
        <label className="block">Project
          <select className="mt-1 w-full rounded-md border border-border bg-background p-2" value={pid} onChange={(e) => { setPid(e.target.value); setTaskId(""); }}>
            <option value="">Choose…</option>
            {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <div>Day you worked
        <DatePicker className="mt-1 w-full" value={date} onChange={setDate} noFuture />
      </div>
      <div>Minutes
        <div className="mt-1 flex flex-wrap gap-1">
          {MINS.map((n) => (
            <Button key={n} type="button" size="sm" variant={mins === String(n) ? "default" : "outline"} onClick={() => setMins(String(n))}>{n}</Button>
          ))}
          <Input className="w-20" type="number" min={1} placeholder="e.g. 40" value={mins} onChange={(e) => setMins(e.target.value)} />
        </div>
      </div>
      {!!tasks.data?.length && (
        <label className="block">Task (optional)
          <select className="mt-1 w-full rounded-md border border-border bg-background p-2" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">No specific task</option>
            {tasks.data.map((t) => <option key={t.id} value={t.id}>{t.status === "done" ? "☑ " : ""}{t.title}</option>)}
          </select>
        </label>
      )}
      {taskId && tasks.data?.find((t) => t.id === taskId)?.status !== "done" && (
        <label className="flex items-center gap-2"><input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} /> Mark this task done on that day</label>
      )}
      <label className="block">What did you work on?
        <Input className="mt-1" placeholder="e.g. Sent 3 applications" value={action} onChange={(e) => setAction(e.target.value)} />
      </label>
      <div>How did it go?
        <div className="mt-1 grid grid-cols-3 gap-1">
          {OUTCOMES.map((o) => (
            <Button key={o.v} type="button" size="sm" className="h-auto whitespace-normal py-2" variant={outcome === o.v ? "default" : "outline"} onClick={() => setOutcome(o.v)}>{o.l}</Button>
          ))}
        </div>
      </div>
      <label className="block">Where did you stop? (optional)
        <Input className="mt-1" placeholder="e.g. Halfway through the cover letter" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button className="w-full" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}
