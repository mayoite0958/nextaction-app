import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MicButton } from "@/components/MicButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { classifyResource } from "@/lib/n8n";
import type { Database } from "@/integrations/supabase/types";

type Resource = Database["public"]["Tables"]["resources"]["Row"];
const TYPES = ["Tutorial", "Technique", "Inspiration"];
const NONE = "";

export const Route = createFileRoute("/_authenticated/resources")({
  head: () => ({
    meta: [
      { title: "Resources — Next Action" },
      { name: "description", content: "Save links, let AI sort them, and find them when a step needs them." },
      { property: "og:title", content: "Resources — Next Action" },
      { property: "og:description", content: "Save links, let AI sort them, and find them when a step needs them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResourcesPage,
});

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

function ResourcesPage() {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [projectId, setProjectId] = useState(NONE);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Resource | null>(null);

  const projectsQ = useQuery({
    queryKey: ["projects", "active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });
  const resQ = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const projects = projectsQ.data ?? [];
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name;

  async function save() {
    if (!note.trim()) { toast.error("Say what this helps with."); return; }
    setSaving(true);
    try {
      const out = await classifyResource({
        url: url.trim(),
        note: note.trim(),
        projects: projects.map((p) => ({ id: p.id, name: p.name, goal: p.goal })),
      });
      const aiProject = out.project_id && projects.some((p) => p.id === out.project_id) ? out.project_id : null;
      const { error } = await supabase.from("resources").insert({
        url: url.trim() || null,
        user_note: note.trim(),
        title: out.title,
        resource_type: out.resource_type,
        topic: out.topic,
        problem_helped: out.problem_helped,
        summary: out.summary,
        project_id: projectId || aiProject,
        classified: true,
      });
      if (error) throw error;
      toast.success("Resource saved.");
      setUrl(""); setNote(""); setProjectId(NONE);
      await qc.invalidateQueries({ queryKey: ["resources"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this resource?")) return;
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["resources"] });
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase
      .from("resources")
      .update({
        title: editing.title,
        url: editing.url,
        user_note: editing.user_note,
        resource_type: editing.resource_type,
        topic: editing.topic,
        problem_helped: editing.problem_helped,
        project_id: editing.project_id || null,
      })
      .eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    await qc.invalidateQueries({ queryKey: ["resources"] });
  }

  const term = search.trim().toLowerCase();
  const rows = (resQ.data ?? []).filter((r) =>
    !term ||
    [r.title, r.url, r.user_note, r.topic, r.problem_helped, r.summary, r.resource_type]
      .some((v) => v?.toLowerCase().includes(term)),
  );
  const groupOf = (r: Resource) => TYPES.find((t) => t.toLowerCase() === r.resource_type?.toLowerCase()) ?? "Other";
  const groups = [...TYPES, "Other"].map((g) => ({ g, items: rows.filter((r) => groupOf(r) === g) })).filter((x) => x.items.length);

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Resources</h1>
      <p className="mt-2 text-sm text-muted-foreground">Save a link and what it helps with. AI sorts it for you.</p>

      <section className="panel mt-6 space-y-3 p-5">
        <Input placeholder="Link (https://…)" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex gap-2">
          <Input placeholder="What does this help with?" value={note} onChange={(e) => setNote(e.target.value)} />
          <MicButton onText={(t) => setNote((n) => (n ? `${n} ${t}` : t))} />
        </div>
        <select className={selectCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value={NONE}>No project (let AI pick)</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Button onClick={save} disabled={saving || !note.trim()}>{saving ? "Sorting…" : "Save resource"}</Button>
      </section>

      <Input className="mt-8" placeholder="Search resources" value={search} onChange={(e) => setSearch(e.target.value)} />

      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{resQ.isLoading ? "Loading…" : "No resources yet."}</p>
      ) : (
        groups.map(({ g, items }) => (
          <section key={g} className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{g}</h2>
            <ul className="mt-3 space-y-3">
              {items.map((r) =>
                editing?.id === r.id ? (
                  <li key={r.id} className="panel space-y-2 p-4">
                    <Input placeholder="Title" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                    <Input placeholder="Link" value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
                    <Input placeholder="What does this help with?" value={editing.user_note ?? ""} onChange={(e) => setEditing({ ...editing, user_note: e.target.value })} />
                    <Input placeholder="Topic" value={editing.topic ?? ""} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} />
                    <Input placeholder="Problem it helps with" value={editing.problem_helped ?? ""} onChange={(e) => setEditing({ ...editing, problem_helped: e.target.value })} />
                    <select className={selectCls} value={editing.resource_type ?? ""} onChange={(e) => setEditing({ ...editing, resource_type: e.target.value || null })}>
                      <option value="">Other</option>
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select className={selectCls} value={editing.project_id ?? ""} onChange={(e) => setEditing({ ...editing, project_id: e.target.value || null })}>
                      <option value="">No project</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </li>
                ) : (
                  <li key={r.id} className="panel p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{r.title || r.url || r.user_note}</p>
                        {r.problem_helped && <p className="text-muted-foreground">{r.problem_helped}</p>}
                        {r.summary && <p className="mt-1">{r.summary}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[r.topic, projectName(r.project_id)].filter(Boolean).join(" · ")}
                        </p>
                        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="break-all text-primary underline">{r.url}</a>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Delete</Button>
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))
      )}
    </AppShell>
  );
}
