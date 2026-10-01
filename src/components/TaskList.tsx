import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const ENERGIES = ["Low", "Medium", "High"];

export function TaskList({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [est, setEst] = useState("");
  const [energy, setEnergy] = useState("Medium");

  const q = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .neq("status", "dropped")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", projectId] });

  async function add() {
    if (!title.trim()) return;
    const n = Number.parseInt(est, 10);
    const { error } = await supabase.from("tasks").insert({
      project_id: projectId,
      title: title.trim(),
      est_minutes: Number.isFinite(n) && n > 0 ? n : null,
      energy,
      status: "todo",
    });
    if (error) { toast.error(error.message); return; }
    setTitle("");
    setEst("");
    void refresh();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    void refresh();
  }

  const tasks = q.data ?? [];
  return (
    <section className="panel mt-6 p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-primary">Tasks</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          className="min-w-48 flex-1"
          placeholder="Add a task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Input className="w-24" type="number" min={1} placeholder="min" value={est} onChange={(e) => setEst(e.target.value)} />
        <div className="flex gap-1">
          {ENERGIES.map((en) => (
            <Button key={en} type="button" size="sm" variant={energy === en ? "default" : "outline"} onClick={() => setEnergy(en)}>
              {en}
            </Button>
          ))}
        </div>
        <Button onClick={add} disabled={!title.trim()}>Add</Button>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tasks.map((t) => {
            const done = t.status === "done";
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-md border border-border p-2 text-sm">
                <button
                  type="button"
                  className="text-lg"
                  aria-label={done ? "Mark not done" : "Mark done"}
                  onClick={() => setStatus(t.id, done ? "todo" : "done")}
                >
                  {done ? "☑" : "☐"}
                </button>
                <span className={`flex-1 ${done ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                  {t.status === "doing" && <span className="ml-2 text-xs text-primary">in progress</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.est_minutes ? `${t.est_minutes} min · ` : ""}{t.energy ?? ""}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setStatus(t.id, "dropped")}>Drop</Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
