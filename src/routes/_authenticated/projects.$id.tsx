import { InfoTip } from "@/components/InfoTip";
import type { HelpKey } from "@/lib/help";
import { RestartCard } from "@/components/RestartCard";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { TaskList } from "@/components/TaskList";
import { WeeklyReview } from "@/components/WeeklyReview";
import { ProjectResources } from "@/components/ProjectResources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { bucketLabel, daysLeft, relativeTime, slugifyBucket } from "@/lib/nextaction";
import { planProject } from "@/lib/n8n";
import {
  PROJECT_TYPES,
  computeProgress,
  parseMilestones,
  projectType,
  weekStart,
  type Milestone,
  type ProjectType,
} from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project — Next Action" },
      { name: "description", content: "Edit a project and track its progress." },
      { property: "og:title", content: "Project — Next Action" },
      { property: "og:description", content: "Edit a project and track its progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectPage,
});

type Form = {
  name: string;
  goal: string;
  deadline: string;
  status: string;
  bucket: string;
  value_score: number;
  project_type: ProjectType;
  done_definition: string;
  milestones: Milestone[];
  count_total: string;
  count_done: number;
  weekly_target: string;
  progress_summary: string;
  blocker: string;
  last_meaningful_action: string;
  next_likely_action: string;
};

const EMPTY: Form = {
  name: "",
  goal: "",
  deadline: "",
  status: "active",
  bucket: "long_term",
  value_score: 3,
  project_type: "finish_line",
  done_definition: "",
  milestones: [],
  count_total: "",
  count_done: 0,
  weekly_target: "",
  progress_summary: "",
  blocker: "",
  last_meaningful_action: "",
  next_likely_action: "",
};

function ProjectPage() {
  const [showRecap, setShowRecap] = useState(false);
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [update, setUpdate] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const projectQuery = useQuery({
    queryKey: ["project", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const bucketsQuery = useQuery({
    queryKey: ["project_buckets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("bucket");
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.bucket).filter((b): b is string => !!b))];
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ["project_sessions", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, created_at, recommended_action, outcome, where_stopped, status")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const p = projectQuery.data;
  useEffect(() => {
    if (!p) return;
    setForm({
      name: p.name ?? "",
      goal: p.goal ?? "",
      deadline: p.deadline ?? "",
      status: p.status ?? "active",
      bucket: p.bucket ?? "long_term",
      value_score: p.value_score ?? 3,
      project_type: projectType(p.project_type),
      done_definition: p.done_definition ?? "",
      milestones: parseMilestones(p.milestones),
      count_total: p.count_total != null ? String(p.count_total) : "",
      count_done: p.count_done ?? 0,
      weekly_target: p.weekly_target != null ? String(p.weekly_target) : "",
      progress_summary: p.progress_summary ?? "",
      blocker: p.blocker ?? "",
      last_meaningful_action: p.last_meaningful_action ?? "",
      next_likely_action: p.next_likely_action ?? "",
    });
  }, [p]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const settings = settingsQuery.data;
  const knownBuckets = bucketsQuery.data ?? [];
  const customBuckets = knownBuckets.filter((b) => b !== "urgent" && b !== "long_term");
  const effectiveBucket = addingCategory
    ? slugifyBucket(newCategory) || "long_term"
    : form.bucket;

  const weekQuery = useQuery({
    queryKey: ["project_week", id],
    enabled: !isNew,
    queryFn: async () => {
      return fetchProjectWeekCount(id);
    },
  });
  const doneThisWeek = weekQuery.data ?? 0;
  const numOrNull = (v: string) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const typeFields = () => ({
    project_type: form.project_type,
    done_definition: form.done_definition || null,
    milestones: form.milestones.filter((m) => m.title.trim()),
    count_total: numOrNull(form.count_total),
    count_done: form.count_done,
    weekly_target: numOrNull(form.weekly_target),
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .neq("status", "dropped")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const progress = computeProgress(typeFields(), doneThisWeek, tasksQuery.data ?? []);
  const [planning, setPlanning] = useState(false);
  const [firstTasks, setFirstTasks] = useState<
    { title: string; est_minutes: string; energy: string; kept: boolean }[]
  >([]);
  async function generate() {
    if (!form.name.trim()) { toast.error("Give the project a name first."); return; }
    setPlanning(true);
    try {
      const plan = await planProject({ name: form.name.trim(), goal: form.goal });
      setForm((f) => ({
        ...f,
        done_definition: plan.done_definition ?? f.done_definition,
        milestones: plan.milestones.length ? plan.milestones : f.milestones,
      }));
      setFirstTasks(
        plan.first_tasks.map((t) => ({
          title: t.title,
          est_minutes: t.est_minutes != null ? String(t.est_minutes) : "",
          energy: t.energy ?? "",
          kept: true,
        })),
      );
      toast.success("Milestones drafted — edit them, then save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach n8n");
    } finally {
      setPlanning(false);
    }
  }
  const setMilestone = (i: number, patch: Partial<Milestone>) =>
    set("milestones", form.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const weightTotal = form.milestones.reduce((s, m) => s + (m.weight || 0), 0);

  const payload = () => ({
    ...typeFields(),
    name: form.name.trim(),
    goal: form.goal || null,
    deadline: form.deadline || null,
    status: form.status,
    bucket: effectiveBucket,
    value_score: form.value_score,
    progress_percent: progress,
    progress_summary: form.progress_summary || null,
    blocker: form.blocker || null,
    last_meaningful_action: form.last_meaningful_action || null,
    next_likely_action: form.next_likely_action || null,
  });

  async function save() {
    if (!form.name.trim()) { toast.error("Give the project a name."); return; }
    setSaving(true);
    const res = isNew
      ? await supabase.from("projects").insert(payload()).select("id").single()
      : await supabase.from("projects").update(payload()).eq("id", id).select("id").single();
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    const kept = firstTasks.filter((t) => t.kept && t.title.trim());
    if (kept.length) {
      const firstMilestone = form.milestones.find((m) => m.title.trim())?.title.trim() ?? null;
      const { error: tasksError } = await supabase.from("tasks").insert(
        kept.map((t) => ({
          project_id: res.data.id,
          milestone: firstMilestone,
          title: t.title.trim(),
          est_minutes: numOrNull(t.est_minutes),
          energy: t.energy.trim() || null,
          status: "todo",
          source: "ai",
        })),
      );
      if (tasksError) toast.error(tasksError.message);
      else {
        setFirstTasks([]);
        void qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    }
    toast.success("Project saved.");
    await qc.invalidateQueries({ queryKey: ["projects"] });
    await qc.invalidateQueries({ queryKey: ["project", id] });
    await qc.invalidateQueries({ queryKey: ["project_buckets"] });
    if (isNew) navigate({ to: "/projects/$id", params: { id: res.data.id }, replace: true });
  }

  async function logProgress() {
    if (!update.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const stamp = new Date().toLocaleDateString();
    const summary = `${stamp}: ${update.trim()}${form.progress_summary ? `\n${form.progress_summary}` : ""}`;
    const { error } = await supabase
      .from("projects")
      .update({ last_meaningful_action: update.trim(), last_worked_at: now, progress_summary: summary })
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setUpdate("");
    toast.success("Progress logged.");
    await qc.invalidateQueries({ queryKey: ["project", id] });
    await qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function remove() {
    if (!confirm("Delete this project? This can't be undone.")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["projects"] });
    navigate({ to: "/today" });
  }

  if (!isNew && projectQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </AppShell>
    );
  }
  if (!isNew && !p) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link to="/today" className="mt-4 inline-block text-primary underline">Back to Today</Link>
      </AppShell>
    );
  }

  const left = daysLeft(form.deadline || null);

  return (
    <AppShell>
      <Link to="/today" className="text-sm text-muted-foreground hover:text-foreground">← Today</Link>
      <h1 className="mt-2 text-3xl font-bold">{isNew ? "New project" : form.name || "Project"}</h1>
      {!isNew && (
        <p className="mt-2 text-sm text-muted-foreground">
          {left === null ? "No deadline" : left < 0 ? `${Math.abs(left)} days overdue` : `${left} days left`}
          {" · "}Last worked {relativeTime(p?.last_worked_at ?? null)}
        </p>
      )}

      {!isNew && p && (
        <div className="mt-4">
          {showRecap ? (
            <RestartCard project={{ id: p.id, name: p.name, next_likely_action: p.next_likely_action }} onClose={() => setShowRecap(false)} />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowRecap(true)}>👋 Recap</Button>
          )}
        </div>
      )}

      {!isNew && <TaskList projectId={id} />}
      {!isNew && <ProjectResources projectId={id} />}
      {!isNew && <WeeklyReview projectId={id} />}

      {!isNew && (
        <section className="panel mt-6 p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
            Log progress
          </h2>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="What did you just get done?"
              value={update}
              onChange={(e) => setUpdate(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logProgress()}
            />
            <Button onClick={logProgress} disabled={saving || !update.trim()}>Log</Button>
          </div>
          {form.progress_summary && (
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
              {form.progress_summary}
            </pre>
          )}
        </section>
      )}

      <section className="panel mt-6 grid gap-4 p-5">
        <Field label="Name" help="projectName"><Input placeholder="e.g. Product designer job hunt" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Goal" help="goal"><Textarea placeholder="e.g. Get a product designer job" value={form.goal} onChange={(e) => set("goal", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Deadline" help="deadline">
            <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
          </Field>
          <Field label="Category" help="category">
            <Select
              value={addingCategory ? "__new" : form.bucket}
              onValueChange={(v) => {
                if (v === "__new") {
                  setAddingCategory(true);
                } else {
                  setAddingCategory(false);
                  set("bucket", v);
                }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">{bucketLabel(settings, "urgent")}</SelectItem>
                <SelectItem value="long_term">{bucketLabel(settings, "long_term")}</SelectItem>
                {customBuckets.map((b) => (
                  <SelectItem key={b} value={b}>{bucketLabel(settings, b)}</SelectItem>
                ))}
                <SelectItem value="__new">+ New category…</SelectItem>
              </SelectContent>
            </Select>
            {addingCategory && (
              <Input
                className="mt-2"
                placeholder="Category name, e.g. Health & family"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Field label="Status" help="status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={`Importance: ${form.value_score}/5`} help="importance">
          <Slider min={1} max={5} step={1} value={[form.value_score]} onValueChange={(v) => set("value_score", v[0] ?? 3)} />
        </Field>
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="flex items-center text-muted-foreground">Project type<InfoTip k="projectType" /></span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPES.map((t) => (
              <Button
                key={t.value}
                type="button"
                size="sm"
                variant={form.project_type === t.value ? "default" : "outline"}
                onClick={() => set("project_type", t.value)}
                title={t.hint}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        {form.project_type === "finish_line" && (
          <div className="grid gap-3 rounded-md border border-border p-4">
            <Field label="Done looks like" help="doneDefinition">
              <Textarea placeholder="e.g. Signed offer letter from a design team" value={form.done_definition} onChange={(e) => set("done_definition", e.target.value)} />
            </Field>
            <div className="flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center text-sm text-muted-foreground">
                <InfoTip k="milestones" />Milestones · weights total {weightTotal}%{weightTotal !== 100 && " (aim for 100)"}
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={generate} disabled={planning}>
                {planning ? "Generating…" : "Generate milestones with AI"}
              </Button>
            </div>
            {form.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={m.done}
                  onChange={(e) => setMilestone(i, { done: e.target.checked })}
                  aria-label="Done"
                />
                <Input value={m.title} placeholder="e.g. Portfolio ready" onChange={(e) => setMilestone(i, { title: e.target.value })} />
                <Input
                  type="number"
                  className="w-20"
                  value={m.weight}
                  onChange={(e) => setMilestone(i, { weight: Number(e.target.value) || 0 })}
                  aria-label="Weight %"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => set("milestones", form.milestones.filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => set("milestones", [...form.milestones, { title: "", weight: 0, done: false }])}
            >
              + Add milestone
            </Button>
            {firstTasks.length > 0 && (
              <div className="grid gap-2 border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">
                  First tasks — untick any you don't want; they're added when you save
                </span>
                {firstTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={t.kept}
                      onChange={(e) =>
                        setFirstTasks((ts) => ts.map((x, j) => (j === i ? { ...x, kept: e.target.checked } : x)))
                      }
                      aria-label="Add this task"
                    />
                    <Input
                      value={t.title}
                      placeholder="e.g. Update case study 1"
                      onChange={(e) =>
                        setFirstTasks((ts) => ts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                      }
                    />
                    <Input
                      type="number"
                      className="w-20"
                      placeholder="min"
                      value={t.est_minutes}
                      onChange={(e) =>
                        setFirstTasks((ts) => ts.map((x, j) => (j === i ? { ...x, est_minutes: e.target.value } : x)))
                      }
                      aria-label="Estimated minutes"
                    />
                    <Input
                      className="w-24"
                      placeholder="e.g. Low"
                      value={t.energy}
                      onChange={(e) =>
                        setFirstTasks((ts) => ts.map((x, j) => (j === i ? { ...x, energy: e.target.value } : x)))
                      }
                      aria-label="Energy"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {form.project_type === "countable" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total to get through" help="countTotal">
              <Input placeholder="e.g. 12" type="number" min={1} value={form.count_total} onChange={(e) => set("count_total", e.target.value)} />
            </Field>
            <Field label="Done so far" help="countDone">
              <Input placeholder="e.g. 3" type="number" min={0} value={form.count_done} onChange={(e) => set("count_done", Math.max(0, Number(e.target.value) || 0))} />
            </Field>
          </div>
        )}
        {form.project_type === "ongoing" && (
          <Field label="Sessions per week" help="weeklyTarget">
            <Input placeholder="e.g. 3" type="number" min={1} className="w-28" value={form.weekly_target} onChange={(e) => set("weekly_target", e.target.value)} />
          </Field>
        )}
        <div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span className="flex items-center">Progress (calculated)<InfoTip k="progress" /></span>
            <span>
              {form.project_type === "ongoing"
                ? `${doneThisWeek}/${numOrNull(form.weekly_target) ?? "?"} this week`
                : `${progress}%`}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <Field label="Blocker" help="blocker"><Input placeholder="e.g. Waiting for feedback from mentor" value={form.blocker} onChange={(e) => set("blocker", e.target.value)} /></Field>
        <Field label="Last meaningful action" help="lastAction">
          <Input placeholder="e.g. Sent portfolio to 3 recruiters" value={form.last_meaningful_action} onChange={(e) => set("last_meaningful_action", e.target.value)} />
        </Field>
        <Field label="Next likely action" help="nextAction">
          <Input placeholder="e.g. Email Rahul about the referral" value={form.next_likely_action} onChange={(e) => set("next_likely_action", e.target.value)} />
        </Field>
        <Field label="Progress notes" help="progressNotes">
          <Textarea placeholder="e.g. Recruiters like case study 2 most" rows={5} value={form.progress_summary} onChange={(e) => set("progress_summary", e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save project"}</Button>
          {!isNew && <Button variant="outline" onClick={remove}>Delete project</Button>}
        </div>
      </section>

      {!isNew && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Work sessions</h2>
          {(sessionsQuery.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No sessions recorded for this project yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sessionsQuery.data!.map((s) => (
                <li key={s.id} className="panel p-4 text-sm">
                  <p className="text-muted-foreground">{relativeTime(s.created_at)} · {s.status ?? "—"}</p>
                  {s.recommended_action && <p className="mt-1 font-medium">{s.recommended_action}</p>}
                  {s.outcome && <p className="mt-1">Outcome: {s.outcome}</p>}
                  {s.where_stopped && <p className="mt-1 text-muted-foreground">Stopped at: {s.where_stopped}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}

function Field({ label, help, children }: { label: string; help?: HelpKey; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="flex items-center text-muted-foreground">{label}{help && <InfoTip k={help} />}</span>
      {children}
    </label>
  );
}
