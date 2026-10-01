import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import { daysLeft, relativeTime } from "@/lib/nextaction";

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
  progress_summary: "",
  blocker: "",
  last_meaningful_action: "",
  next_likely_action: "",
};

function ProjectPage() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [update, setUpdate] = useState("");
  const [saving, setSaving] = useState(false);

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
      progress_summary: p.progress_summary ?? "",
      blocker: p.blocker ?? "",
      last_meaningful_action: p.last_meaningful_action ?? "",
      next_likely_action: p.next_likely_action ?? "",
    });
  }, [p]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const urgentLabel = settingsQuery.data?.bucket_urgent_label ?? "Urgent";
  const longtermLabel = settingsQuery.data?.bucket_longterm_label ?? "Long-term";

  const payload = () => ({
    name: form.name.trim(),
    goal: form.goal || null,
    deadline: form.deadline || null,
    status: form.status,
    bucket: form.bucket,
    value_score: form.value_score,
    progress_summary: form.progress_summary || null,
    blocker: form.blocker || null,
    last_meaningful_action: form.last_meaningful_action || null,
    next_likely_action: form.next_likely_action || null,
  });

  async function save() {
    if (!form.name.trim()) return toast.error("Give the project a name.");
    setSaving(true);
    const res = isNew
      ? await supabase.from("projects").insert(payload()).select("id").single()
      : await supabase.from("projects").update(payload()).eq("id", id).select("id").single();
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Project saved.");
    await qc.invalidateQueries({ queryKey: ["projects"] });
    await qc.invalidateQueries({ queryKey: ["project", id] });
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
    if (error) return toast.error(error.message);
    setUpdate("");
    toast.success("Progress logged.");
    await qc.invalidateQueries({ queryKey: ["project", id] });
    await qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function remove() {
    if (!confirm("Delete this project? This can't be undone.")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
        <Field label="Name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Goal"><Textarea value={form.goal} onChange={(e) => set("goal", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Deadline">
            <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={form.bucket} onValueChange={(v) => set("bucket", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">{urgentLabel}</SelectItem>
                <SelectItem value="long_term">{longtermLabel}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={`Value: ${form.value_score}/5`}>
          <Slider min={1} max={5} step={1} value={[form.value_score]} onValueChange={(v) => set("value_score", v[0] ?? 3)} />
        </Field>
        <Field label="Blocker"><Input value={form.blocker} onChange={(e) => set("blocker", e.target.value)} /></Field>
        <Field label="Last meaningful action">
          <Input value={form.last_meaningful_action} onChange={(e) => set("last_meaningful_action", e.target.value)} />
        </Field>
        <Field label="Next likely action">
          <Input value={form.next_likely_action} onChange={(e) => set("next_likely_action", e.target.value)} />
        </Field>
        <Field label="Progress notes">
          <Textarea rows={5} value={form.progress_summary} onChange={(e) => set("progress_summary", e.target.value)} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
