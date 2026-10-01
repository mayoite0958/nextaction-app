import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MicButton } from "@/components/MicButton";

type Ev = { id: string; ts: string | null; type: string | null; text: string | null; session_id: string | null };

const LABELS: Record<string, string> = {
  step_done: "✓ Step done",
  stuck: "😣 Stuck",
  note: "🎤 Note",
  pause: "⏸ Paused",
  resume: "▶ Resumed",
  switch: "↪ Switched on purpose",
};

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
  onEnd,
}: {
  sessionId: string;
  startedAt: string;
  projectId: string | null;
  onEnd: () => void;
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
  const all = evQuery.data ?? [];
  const mine = all.filter((e) => e.session_id === sessionId);
  const lastToggle = [...mine].reverse().find((e) => e.type === "pause" || e.type === "resume");
  const paused = lastToggle?.type === "pause";

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);

  async function tap(type: string, text: string | null = null) {
    const { error } = await supabase.from("session_events").insert({ session_id: sessionId, type, text });
    if (error) { toast.error(error.message); return; }
    if (type === "note" && text && projectId) {
      await supabase.from("project_notes").insert({ project_id: projectId, type: "note", text, source: "session" });
    }
    setNow(Date.now());
    await qc.invalidateQueries({ queryKey: ["session_events_today"] });
  }

  async function saveNote() {
    if (!note.trim()) return;
    await tap("note", note.trim());
    setNote("");
    setNoteOpen(false);
  }

  const secs = Math.floor(workedMs(startedAt, mine, paused ? new Date(lastToggle?.ts ?? now).getTime() : now) / 1000);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="flex items-baseline justify-between">
        <span className={`text-sm ${paused ? "text-muted-foreground" : "text-primary"}`}>
          {paused ? "Paused" : "Session in progress"}
        </span>
        <span className="font-display text-3xl font-semibold tabular-nums">{clock}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button variant="outline" onClick={() => tap("step_done")} disabled={paused}>✓ Step done</Button>
        <Button variant="outline" onClick={() => tap("stuck")} disabled={paused}>😣 I'm stuck</Button>
        <Button variant="outline" onClick={() => setNoteOpen((o) => !o)}>🎤 Quick note</Button>
        <Button variant={paused ? "default" : "outline"} onClick={() => tap(paused ? "resume" : "pause")}>
          {paused ? "▶ Resume" : "⏸ Pause"}
        </Button>
        <Button variant="outline" onClick={() => tap("switch")}>↪ Switched on purpose</Button>
        <Button onClick={onEnd}>End session</Button>
      </div>
      {noteOpen && (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Say or type a note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveNote()}
          />
          <MicButton onText={(t) => setNote((n) => (n ? `${n} ${t}` : t))} />
          <Button onClick={saveNote} disabled={!note.trim()}>Save</Button>
        </div>
      )}
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
